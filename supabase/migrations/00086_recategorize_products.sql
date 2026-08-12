-- Migration 00086: Re-catégorisation des produits mal classés au POS
-- =============================================================================
--   Les produits issus du seed démo ont été écrasés vers 'snacks' par 00050,
--   laissant la catégorie 'vetements' vide et faussant la recherche par
--   catégorie au point de vente. On réaffecte les produits à leur vraie
--   catégorie. Les noms contiennent des '?' à la place des accents (encodage
--   d'origine), d'où les motifs LIKE.
--   Idempotent : chaque UPDATE est conditionné à une catégorie différente.
-- =============================================================================

-- Vêtements
UPDATE products SET category = 'vetements'
WHERE name LIKE 'T-shirt sport' AND category IS DISTINCT FROM 'vetements';
UPDATE products SET category = 'vetements'
WHERE name LIKE 'Short sport' AND category IS DISTINCT FROM 'vetements';
UPDATE products SET category = 'vetements'
WHERE name LIKE 'Casquette' AND category IS DISTINCT FROM 'vetements';

-- Équipement & accessoires
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Gant de musculation' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Poign%e de traction' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Foam roller' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Balle de massage' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE '%lastique de r%sistance' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Genouill%re' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Serviette microfibre' AND category IS DISTINCT FROM 'equipement';
UPDATE products SET category = 'equipement'
WHERE name LIKE 'Shaker 600ml' AND category IS DISTINCT FROM 'equipement';

-- Compléments
UPDATE products SET category = 'complements'
WHERE name LIKE 'BCAA 500g' AND category IS DISTINCT FROM 'complements';
UPDATE products SET category = 'complements'
WHERE name LIKE 'Cr%itine 300g' AND category IS DISTINCT FROM 'complements';
UPDATE products SET category = 'complements'
WHERE name LIKE 'Prot%ine Whey 1kg' AND category IS DISTINCT FROM 'complements';
UPDATE products SET category = 'complements'
WHERE name LIKE 'Pr%-workout 300g' AND category IS DISTINCT FROM 'complements';

-- Boissons
UPDATE products SET category = 'boissons'
WHERE name LIKE 'Jus d''orange' AND category IS DISTINCT FROM 'boissons';
UPDATE products SET category = 'boissons'
WHERE name LIKE 'Infusion' AND category IS DISTINCT FROM 'boissons';

-- Snacks (Barre protéinée actuellement classée en boissons)
UPDATE products SET category = 'snacks'
WHERE name LIKE 'Barre prot%in%e' AND category IS DISTINCT FROM 'snacks';
