-- Seed subscription_types + subscriptions pour les 851 membres QLF GYM
-- Répartition : journaliers actifs, mensuels actifs, expirés

DO $$
DECLARE
  org_id UUID := '782738ec-0277-4bbb-aee2-b3ec561b2a07';
  v_daily_id UUID;
  v_monthly_id UUID;
  v_child_id UUID;
  v_member RECORD;
  v_count INT := 0;
  v_total INT;
BEGIN
  -- Create daily subscription type
  INSERT INTO subscription_types (organization_id, name, duration_days, price, max_classes)
    VALUES (org_id, 'Journalier', 1, 500, NULL)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_daily_id;

  -- Get existing IDs
  SELECT id INTO v_daily_id FROM subscription_types WHERE organization_id = org_id AND name = 'Journalier' LIMIT 1;
  SELECT id INTO v_monthly_id FROM subscription_types WHERE organization_id = org_id AND name = 'Mensuel ' LIMIT 1;
  SELECT id INTO v_child_id FROM subscription_types WHERE organization_id = org_id AND name = 'ENFANT' LIMIT 1;

  SELECT count(*) INTO v_total FROM members WHERE organization_id = org_id;

  FOR v_member IN
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as rn
    FROM members
    WHERE organization_id = org_id
  LOOP
    v_count := v_count + 1;

    -- 1-250 : Journaliers actifs (d'aujourd'hui, expire demain)
    IF v_count <= 250 THEN
      INSERT INTO member_subscriptions (member_id, organization_id, subscription_type_id, status, start_date, end_date, amount_paid, total_amount)
      VALUES (v_member.id, org_id, v_daily_id, 'active', CURRENT_DATE, CURRENT_DATE + 1, 500, 500);

    -- 251-400 : Mensuels actifs (expire dans 25-30 jours)
    ELSIF v_count <= 400 THEN
      INSERT INTO member_subscriptions (member_id, organization_id, subscription_type_id, status, start_date, end_date, amount_paid, total_amount)
      VALUES (v_member.id, org_id, v_monthly_id, 'active', CURRENT_DATE - 5, CURRENT_DATE + 25, 3000, 3000);

    -- 401-500 : Expirés (fini il y a 1-30 jours)
    ELSIF v_count <= 500 THEN
      INSERT INTO member_subscriptions (member_id, organization_id, subscription_type_id, status, start_date, end_date, amount_paid, total_amount)
      VALUES (v_member.id, org_id, v_monthly_id, 'expired', CURRENT_DATE - 35, CURRENT_DATE - 5, 3000, 3000);

    -- 501-650 : Mensuels actifs (expire dans 10-40 jours)
    ELSIF v_count <= 650 THEN
      INSERT INTO member_subscriptions (member_id, organization_id, subscription_type_id, status, start_date, end_date, amount_paid, total_amount)
      VALUES (v_member.id, org_id, v_monthly_id, 'active', CURRENT_DATE - 20, CURRENT_DATE + 10, 3000, 3000);

    -- 651-750 : Expirés depuis longtemps (2-6 mois)
    ELSIF v_count <= 750 THEN
      INSERT INTO member_subscriptions (member_id, organization_id, subscription_type_id, status, start_date, end_date, amount_paid, total_amount)
      VALUES (v_member.id, org_id, v_monthly_id, 'expired', CURRENT_DATE - 180, CURRENT_DATE - 60, 3000, 3000);

    -- 751-851 : ENFANT actifs
    ELSE
      INSERT INTO member_subscriptions (member_id, organization_id, subscription_type_id, status, start_date, end_date, amount_paid, total_amount)
      VALUES (v_member.id, org_id, v_child_id, 'active', CURRENT_DATE - 10, CURRENT_DATE + 20, 2500, 2500);
    END IF;
  END LOOP;

  RAISE NOTICE 'Subscriptions créées : % sur % membres', v_count, v_total;
END $$;

-- Résumé
SELECT status, count(*) as total FROM member_subscriptions WHERE organization_id = '782738ec-0277-4bbb-aee2-b3ec561b2a07' GROUP BY status;
