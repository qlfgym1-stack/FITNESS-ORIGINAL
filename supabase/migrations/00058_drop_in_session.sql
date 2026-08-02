-- Séance libre POS : type d'abonnement accès ponctuel + membre Visiteur

ALTER TABLE subscription_types ADD COLUMN IF NOT EXISTS is_drop_in BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO members (organization_id, first_name, last_name, status, member_number, notes)
SELECT id, 'Visiteur', 'Séance libre', 'active', 'QLF-VISITEUR', 'Membre factice pour accès séance libre POS'
FROM organizations
WHERE id = '782738ec-0277-4bbb-aee2-b3ec561b2a07'
ON CONFLICT DO NOTHING;

INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes, is_drop_in)
SELECT id, 'Séance libre', 'Accès ponctuel sans abonnement', 1, 250, NULL, TRUE
FROM organizations
WHERE id = '782738ec-0277-4bbb-aee2-b3ec561b2a07'
ON CONFLICT DO NOTHING;
