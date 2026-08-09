-- Migration 00060: Conventions corporate + remise POS sur abonnement
-- 1. Seed des conventions existantes pour l'organisation QLF GYM
INSERT INTO corporate (organization_id, company_name, contact_name, email, phone, address, discount_rate, contract_start, contract_end, is_active)
SELECT o.id, 'Sonatrach', 'Ali Haddad', 'ali@sonatrach.dz', '+213 21 123 456', 'Hydra, Alger', 15, '2026-01-01', '2026-12-31', true
FROM organizations o WHERE o.slug = 'qlf-gym' AND NOT EXISTS (SELECT 1 FROM corporate c WHERE c.organization_id = o.id AND c.company_name = 'Sonatrach');

INSERT INTO corporate (organization_id, company_name, contact_name, email, phone, address, discount_rate, contract_start, contract_end, is_active)
SELECT o.id, 'Air Algérie', 'Samira Bellil', 'samira@airalgerie.dz', '+213 21 789 012', 'Dar El Beida, Alger', 10, '2026-03-01', '2027-02-28', true
FROM organizations o WHERE o.slug = 'qlf-gym' AND NOT EXISTS (SELECT 1 FROM corporate c WHERE c.organization_id = o.id AND c.company_name = 'Air Algérie');

INSERT INTO corporate (organization_id, company_name, contact_name, email, phone, address, discount_rate, contract_start, contract_end, is_active)
SELECT o.id, 'Algerian Telecom', 'Rachid Mansour', 'rachid@telecom.dz', '+213 770 555 555', 'Rouiba, Alger', 20, '2026-02-01', '2026-08-01', false
FROM organizations o WHERE o.slug = 'qlf-gym' AND NOT EXISTS (SELECT 1 FROM corporate c WHERE c.organization_id = o.id AND c.company_name = 'Algerian Telecom');

-- 2. Lien membre -> convention (carte entreprise)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS corporate_id UUID REFERENCES corporate(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_corporate ON members(corporate_id);

-- 3. RPC création membre + abonnement : accepte corporate_id
CREATE OR REPLACE FUNCTION create_member_with_pending_subscription(
  p_organization_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_subscription_type_id UUID,
  p_start_date DATE,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_emergency_phone TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_corporate_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
  v_subscription_id UUID;
  v_type subscription_types;
  v_end_date DATE;
BEGIN
  INSERT INTO members (
    organization_id, first_name, last_name, email, phone, gender,
    birth_date, address, emergency_contact, emergency_phone, photo_url,
    status, last_visit, notes, corporate_id
  ) VALUES (
    p_organization_id, p_first_name, p_last_name, p_email, p_phone, p_gender,
    p_birth_date, p_address, p_emergency_contact, p_emergency_phone, p_photo_url,
    'active', NULL, NULL, p_corporate_id
  )
  RETURNING id INTO v_member_id;

  SELECT * INTO v_type
  FROM subscription_types
  WHERE id = p_subscription_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription type not found';
  END IF;

  v_end_date := p_start_date + (v_type.duration_days || ' days')::INTERVAL;

  INSERT INTO member_subscriptions (
    organization_id, member_id, subscription_type_id,
    start_date, end_date, total_amount, amount_paid, status
  ) VALUES (
    p_organization_id, v_member_id, p_subscription_type_id,
    p_start_date, v_end_date, v_type.price, 0, 'pending_payment'
  )
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'subscription_id', v_subscription_id,
    'total_amount', v_type.price,
    'subscription_name', v_type.name,
    'organization_id', p_organization_id,
    'first_name', p_first_name,
    'last_name', p_last_name
  );
END;
$$;
