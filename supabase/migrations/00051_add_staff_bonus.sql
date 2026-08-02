-- 00051_add_staff_bonus.sql
-- Ajout colonne bonus exceptionnel pour les coachs

BEGIN;

ALTER TABLE staff ADD COLUMN bonus DECIMAL(10,2) DEFAULT 0;

COMMIT;
