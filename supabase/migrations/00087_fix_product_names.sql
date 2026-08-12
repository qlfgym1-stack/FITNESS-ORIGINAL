-- Migration 00087: Correction des noms de produits avec encodage cassé
-- =============================================================================
--   Les noms importés du seed contiennent des '?' à la place des accents
--   (ex. 'Genouill??re' au lieu de 'Genouillère'). On corrige les 9 noms
--   touchés puis on synchronise les fiches d'inventaire liées (product_id)
--   qui portent le même nom cassé, pour garder la règle 1 produit = 1 fiche.
-- =============================================================================

-- Correction des noms produits
UPDATE products SET name = 'Élastique de résistance' WHERE name = '??lastique de r??sistance';
UPDATE products SET name = 'Barre protéinée'         WHERE name = 'Barre prot??in??e';
UPDATE products SET name = 'Boisson énergétique'     WHERE name = 'Boisson ??nerg??tique';
UPDATE products SET name = 'Corde à sauter'          WHERE name = 'Corde ?? sauter';
UPDATE products SET name = 'Créatine 300g'           WHERE name = 'Cr??ditine 300g';
UPDATE products SET name = 'Genouillère'             WHERE name = 'Genouill??re';
UPDATE products SET name = 'Poignée de traction'     WHERE name = 'Poign??e de traction';
UPDATE products SET name = 'Pré-workout 300g'        WHERE name = 'Pr??-workout 300g';
UPDATE products SET name = 'Protéine Whey 1kg'       WHERE name = 'Prot??ine Whey 1kg';

-- Synchronisation des fiches d'inventaire liées à ces produits
UPDATE inventory i
SET name = p.name
FROM products p
WHERE i.product_id = p.id
  AND i.name LIKE '%?%'
  AND i.name IS DISTINCT FROM p.name;
