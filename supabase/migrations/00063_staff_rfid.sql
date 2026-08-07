-- Migration 00063: Attribuer un badge RFID au personnel (coach, admin, réception)
-- Ajoute une colonne rfid_uid à la table staff

ALTER TABLE staff ADD COLUMN IF NOT EXISTS rfid_uid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_rfid_uid ON staff(rfid_uid)
  WHERE rfid_uid IS NOT NULL;
