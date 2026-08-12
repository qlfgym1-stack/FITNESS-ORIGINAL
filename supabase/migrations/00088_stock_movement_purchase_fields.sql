-- ============================================================================
-- 00088 — record_stock_movement : champs achat (unit_price / supplier / reference /
--         mouvement_date) comme record_product_stock_add (00079)
--
-- Contexte : la page Consommables doit permettre de "rajouter du stock" de la
-- meme maniere que les produits (prix unitaire, fournisseur, reference, date)
-- pour que tous les mouvements apparaissent sur l'inventaire.
--
-- Le trigger sync_stock_movement_to_expense (00084) lit deja NEW.unit_price et
-- NEW.movement_date : il creera automatiquement la depense "Achat stock" avec le
-- bon montant et la bonne date.
-- ============================================================================

-- On supprime l'ancienne signature (8 params) pour eviter un overload orphelin
-- (cf. souci de l'overload 00009) et on recree avec les nouveaux params en fin
-- de liste (DEFAULT -> les appels existants a 6-8 params restent valides).
DROP FUNCTION IF EXISTS public.record_stock_movement(uuid, uuid, text, int, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_organization_id uuid,
  p_inventory_id uuid,
  p_type text,
  p_quantity int,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_movement_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_row public.inventory%ROWTYPE;
  v_cur int;
  v_new int;
  v_expected int;
  v_prod uuid;
  v_prod_stock int;
  v_consumable uuid;
  v_consumable_stock int;
  v_mv_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;
  IF p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Invalid type: %', p_type;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_organization_id
      AND ur.role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Verrouille la fiche (ligne complete : product_id/consumable_id inclus)
  SELECT * INTO v_row
  FROM inventory
  WHERE id = p_inventory_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found in organization';
  END IF;
  v_cur := v_row.quantity;

  IF p_type = 'out' AND v_cur < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % < %', v_cur, p_quantity;
  END IF;

  -- Produit lie : verrouiller et verifier la garde de sortie
  v_prod := v_row.product_id;
  IF v_prod IS NOT NULL THEN
    SELECT stock INTO v_prod_stock FROM products WHERE id = v_prod FOR UPDATE;
    IF p_type = 'out' AND COALESCE(v_prod_stock, 0) < p_quantity THEN
      RAISE EXCEPTION 'Insufficient product stock: % < %', COALESCE(v_prod_stock, 0), p_quantity;
    END IF;
  END IF;

  -- Consommable lie : verrouiller et verifier la garde de sortie
  v_consumable := v_row.consumable_id;
  IF v_consumable IS NOT NULL THEN
    SELECT quantity INTO v_consumable_stock FROM consumables WHERE id = v_consumable FOR UPDATE;
    IF p_type = 'out' AND COALESCE(v_consumable_stock, 0) < p_quantity THEN
      RAISE EXCEPTION 'Insufficient consumable stock: % < %', COALESCE(v_consumable_stock, 0), p_quantity;
    END IF;
  END IF;

  v_new := v_cur + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;

  UPDATE inventory SET quantity = v_new WHERE id = p_inventory_id;

  -- Sur un achat, on met a jour prix/fournisseur de la fiche pour que la valeur
  -- d'inventaire reste coherente avec le dernier prix d'achat.
  IF p_type = 'in' AND (p_unit_price IS NOT NULL OR p_supplier_id IS NOT NULL) THEN
    UPDATE inventory
    SET price = COALESCE(p_unit_price, price),
        supplier_id = COALESCE(p_supplier_id, supplier_id)
    WHERE id = p_inventory_id;
  END IF;

  INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, notes, reason, reference_type, reference_id, unit_price, supplier_id, reference, movement_date)
  VALUES (p_inventory_id, v_prod, p_organization_id, p_type, p_quantity, p_notes, p_reason, p_reference_type, p_reference_id, p_unit_price, p_supplier_id, p_reference, COALESCE(p_movement_date, CURRENT_DATE))
  RETURNING id INTO v_mv_id;

  -- Synchronisation products.stock (regle 00079 : stock calcule)
  IF v_prod IS NOT NULL THEN
    v_prod_stock := COALESCE(v_prod_stock, 0) + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;
    UPDATE products SET stock = v_prod_stock WHERE id = v_prod;
  END IF;

  -- Synchronisation consumables.quantity (meme regle)
  IF v_consumable IS NOT NULL THEN
    v_consumable_stock := COALESCE(v_consumable_stock, 0) + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;
    UPDATE consumables SET quantity = v_consumable_stock WHERE id = v_consumable;
  END IF;

  v_expected := public.inventory_expected_stock(p_inventory_id);

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'product_id', v_prod,
    'consumable_id', v_consumable,
    'movement_id', v_mv_id,
    'quantity', v_new,
    'consistent', (v_expected = v_new)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, text, int, text, text, text, uuid, numeric, uuid, text, date) TO authenticated;
