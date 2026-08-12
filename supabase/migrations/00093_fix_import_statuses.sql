-- ============================================================================
-- 00093 — Correction des statuts d'abonnement importés (00092)
--
-- Le champ "is_payed" du fichier source est peu fiable (339 lignes "1" alors
-- que 1029 lignes ont un versement verser > 0). On bascule sur le signal
-- économique : une souscription est "active" si elle est en cours (datefin >=
-- aujourd'hui) et qu'un versement a été enregistré.
-- ============================================================================

DO $$
DECLARE
  v_org UUID := '782738ec-0277-4bbb-aee2-b3ec561b2a07';
BEGIN

  UPDATE member_subscriptions s
  SET status = CASE
        WHEN s.end_date < CURRENT_DATE THEN 'expired'
        WHEN COALESCE(s.amount_paid, 0) > 0 THEN 'active'
        ELSE 'pending_payment'
      END
  WHERE s.import_source = 'BACKUP_ANCIEN_LOGICIEL';

  RAISE NOTICE 'Statuts corrigés pour % abonnements importés', (
    SELECT count(*) FROM member_subscriptions WHERE import_source = 'BACKUP_ANCIEN_LOGICIEL'
  );

END $$;
