-- Migration 00077: Annulation croisée POS <-> Abonnement
-- Cause racine : une vente abonnement au POS crée 2 lignes (pos_transactions avec
-- item virtuel __subscription__/__renewal__ + payments via finalize_subscription_payment /
-- pay_and_renew). Annuler un seul côté laissait l'autre visible dans Encaissements
-- ("l'annulation semble sans effet") et doublait le total journalier.

-- 1. Helpers réutilisables (SECURITY DEFINER, exécutés dans le contexte du caller)

-- Restaure le stock des articles physiques d'une transaction POS
CREATE OR REPLACE FUNCTION public._restore_pos_stock(p_transaction public.pos_transactions)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_prod_id text;
  v_qty int;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_transaction.items) LOOP
    v_prod_id := v_item->>'id';
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_prod_id IS NOT NULL
      AND v_prod_id NOT LIKE '\_\_%'
      AND v_qty > 0 THEN
      UPDATE public.products
      SET stock = stock + v_qty
      WHERE id = v_prod_id::uuid AND organization_id = p_transaction.organization_id;
    END IF;
  END LOOP;
END;
$$;

-- Annule une ligne payments (avec audit) si elle existe et n'est pas déjà annulée
CREATE OR REPLACE FUNCTION public._cancel_payment_row(p_payment_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND OR v_old.status = 'cancelled' THEN
    RETURN;
  END IF;

  UPDATE public.payments
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = p_reason
  WHERE id = p_payment_id;

  INSERT INTO public.payment_changes (organization_id, user_id, member_id, source, payment_id, action, old_data, new_data, reason)
  VALUES (
    v_old.organization_id, auth.uid(), v_old.member_id, 'subscription', p_payment_id, 'cancel',
    jsonb_build_object('status', v_old.status, 'amount', v_old.amount, 'payment_method', v_old.payment_method),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    p_reason
  );
END;
$$;

-- Annule une ligne pos_transactions (stock + audit) si elle existe et n'est pas déjà annulée
CREATE OR REPLACE FUNCTION public._cancel_pos_transaction_row(p_transaction_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.pos_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.pos_transactions WHERE id = p_transaction_id;
  IF NOT FOUND OR v_old.payment_status = 'cancelled' THEN
    RETURN;
  END IF;

  PERFORM public._restore_pos_stock(v_old);

  UPDATE public.pos_transactions
  SET payment_status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = p_reason
  WHERE id = p_transaction_id;

  INSERT INTO public.payment_changes (organization_id, user_id, member_id, source, pos_transaction_id, action, old_data, new_data, reason)
  VALUES (
    v_old.organization_id, auth.uid(), v_old.member_id, 'pos', p_transaction_id, 'cancel',
    jsonb_build_object('status', v_old.payment_status, 'total', v_old.total, 'items', v_old.items),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    p_reason
  );
END;
$$;

-- 2. cancel_payment : annule aussi la/les transactions POS liées (abonnement + renouvellement)

CREATE OR REPLACE FUNCTION public.cancel_payment(p_payment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old public.payments%ROWTYPE;
  v_pos public.pos_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF NOT is_encaissement_operator(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;
  IF COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF v_old.status = 'cancelled' THEN
    RAISE EXCEPTION 'Payment already cancelled';
  END IF;

  PERFORM public._cancel_payment_row(p_payment_id, p_reason);

  -- Lien exact : item __subscription__<subscription_id>
  FOR v_pos IN
    SELECT pt.* FROM public.pos_transactions pt
    WHERE pt.organization_id = v_old.organization_id
      AND pt.payment_status = 'completed'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(pt.items) it
        WHERE it->>'id' = '__subscription__' || v_old.subscription_id::text
      )
  LOOP
    PERFORM public._cancel_pos_transaction_row(v_pos.id, p_reason);
  END LOOP;

  -- Lien renouvellement : même membre + montant + fenêtre temporelle (pay_and_renew
  -- crée le paiement dans le même flux, quelques secondes après la transaction POS)
  FOR v_pos IN
    SELECT pt.* FROM public.pos_transactions pt
    WHERE pt.organization_id = v_old.organization_id
      AND pt.member_id = v_old.member_id
      AND pt.payment_status = 'completed'
      AND pt.total = v_old.amount
      AND abs(extract(epoch FROM (pt.created_at - v_old.payment_date))) < 60
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(pt.items) it
        WHERE it->>'id' LIKE '\_\_renewal\_\_%'
      )
  LOOP
    PERFORM public._cancel_pos_transaction_row(v_pos.id, p_reason);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id);
END;
$function$;

-- 3. cancel_pos_transaction : annule aussi le/les paiements liés

CREATE OR REPLACE FUNCTION public.cancel_pos_transaction(p_transaction_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old public.pos_transactions%ROWTYPE;
  v_item jsonb;
  v_sub_id uuid;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.pos_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF NOT is_encaissement_operator(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;
  IF COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF v_old.payment_status = 'cancelled' THEN
    RAISE EXCEPTION 'Transaction already cancelled';
  END IF;

  PERFORM public._cancel_pos_transaction_row(p_transaction_id, p_reason);

  -- Annuler les paiements liés via les items virtuels
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_old.items) LOOP
    IF v_item->>'id' LIKE '\_\_subscription\_\_%' THEN
      v_sub_id := NULLIF(replace(v_item->>'id', '__subscription__', ''), '')::uuid;
      IF v_sub_id IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM public.payments
        WHERE subscription_id = v_sub_id
          AND organization_id = v_old.organization_id
          AND status = 'completed'
        LIMIT 1;
        IF FOUND THEN
          PERFORM public._cancel_payment_row(v_payment_id, p_reason);
        END IF;
      END IF;
    ELSIF v_item->>'id' LIKE '\_\_renewal\_\_%' THEN
      SELECT id INTO v_payment_id FROM public.payments
      WHERE organization_id = v_old.organization_id
        AND member_id = v_old.member_id
        AND amount = v_old.total
        AND status = 'completed'
        AND abs(extract(epoch FROM (payment_date - v_old.created_at))) < 60
      ORDER BY payment_date DESC
      LIMIT 1;
      IF FOUND THEN
        PERFORM public._cancel_payment_row(v_payment_id, p_reason);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'pos_transaction_id', p_transaction_id);
END;
$function$;

-- Grants : les helpers sont appelés depuis les RPC SECURITY DEFINER (propriétaire), pas besoin
-- de grant pour le rôle public. Les RPC principaux conservent leur grant EXECUTE existant.
