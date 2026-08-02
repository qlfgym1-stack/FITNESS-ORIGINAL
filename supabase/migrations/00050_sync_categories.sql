-- 00050_sync_categories.sql
-- Synchronise les catégories produits vers 5 valeurs fixes :
-- snacks, boissons, complements, vetements, equipement

BEGIN;

-- Mapper les anciennes catégories FR → nouvelles valeurs normalisées
UPDATE products SET category = 'boissons'   WHERE lower(category) IN ('boissons', 'drinks');
UPDATE products SET category = 'complements' WHERE lower(category) IN ('compléments', 'supplements');
UPDATE products SET category = 'snacks'     WHERE lower(category) = 'snacks';
UPDATE products SET category = 'vetements'  WHERE lower(category) IN ('vêtements', 'apparel');
UPDATE products SET category = 'equipement' WHERE lower(category) IN ('équipement', 'equipment', 'accessoires', 'hygiène');
UPDATE products SET category = 'snacks'     WHERE category IS NULL OR category NOT IN ('snacks','boissons','complements','vetements','equipement');

-- CHECK constraint pour empêcher les futures inserts invalides
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('snacks','boissons','complements','vetements','equipement'));

COMMIT;
