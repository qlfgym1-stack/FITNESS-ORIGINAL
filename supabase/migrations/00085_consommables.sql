-- Migration 00085: Rubrique "Consommables" — produits d'entretien & consommables
-- de la salle (NON vendus au POS).
-- =============================================================================
--   1. Table consumables (entretien/hygiene/sanitaire/bureau/securite/autre)
--      + RLS (admin CRUD, staff/coach lecture seule) + indexes
--   2. inventory.consumable_id : chaque consommable a SA fiche d'inventaire
--      (ledger 00078) via trigger sync_consumable_to_inventory (pattern 00082)
--   3. investments.category : ajoute 'consommables' au CHECK (00046)
--   4. Seed : liste de produits d'entretien/consommables a stock 0 pour chaque
--      organisation existante
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table consumables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'entretien'
    CHECK (category IN ('entretien','hygiene','sanitaire','bureau','securite','autre')),
  brand TEXT,
  unit TEXT DEFAULT 'piece',
  quantity INT DEFAULT 0,
  min_stock INT DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  image_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage consumables" ON consumables
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = consumables.organization_id
          AND role IN ('admin')
      )
  );

CREATE POLICY "Staff can view consumables" ON consumables
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_consumables_org ON consumables (organization_id);
CREATE INDEX IF NOT EXISTS idx_consumables_category ON consumables (category);

-- ---------------------------------------------------------------------------
-- 2. Lien inventaire : inventory.consumable_id + trigger (pattern equipment 00082)
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_consumable_id ON inventory (consumable_id);

CREATE OR REPLACE FUNCTION public.sync_consumable_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
BEGIN
  SELECT id INTO v_inv_id FROM inventory WHERE consumable_id = NEW.id LIMIT 1;
  IF v_inv_id IS NULL THEN
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = NEW.organization_id
      AND lower(name) = lower(NEW.name)
      AND product_id IS NULL
      AND equipment_id IS NULL
      AND consumable_id IS NULL
    LIMIT 1;
  END IF;

  IF v_inv_id IS NULL THEN
    INSERT INTO inventory (organization_id, name, category, unit, quantity, stock_initial, min_stock, price, supplier_id, image_url, consumable_id)
    VALUES (NEW.organization_id, NEW.name, 'consommables', COALESCE(NEW.unit, 'piece'),
            COALESCE(NEW.quantity, 0), COALESCE(NEW.quantity, 0), COALESCE(NEW.min_stock, 0),
            COALESCE(NEW.cost, 0), NEW.supplier_id, NEW.image_url, NEW.id);
  ELSE
    UPDATE inventory
    SET consumable_id = NEW.id,
        category = 'consommables',
        unit = COALESCE(NEW.unit, unit),
        min_stock = COALESCE(NEW.min_stock, min_stock),
        price = COALESCE(NEW.cost, price),
        supplier_id = COALESCE(NEW.supplier_id, supplier_id),
        image_url = COALESCE(NEW.image_url, image_url)
    WHERE id = v_inv_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consumable_to_inventory ON consumables;
CREATE TRIGGER trg_consumable_to_inventory
AFTER INSERT ON consumables
FOR EACH ROW
EXECUTE FUNCTION public.sync_consumable_to_inventory();

-- ---------------------------------------------------------------------------
-- 3. investments.category : ajoute 'consommables'
--    La contrainte 00046 etait inline (nom auto) : on la retrouve par pg_constraint
--    sur la colonne category, on la droppe et on recree un CHECK nomme complet.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
  v_attnum int;
BEGIN
  SELECT attnum INTO v_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.investments'::regclass AND attname = 'category';
  IF v_attnum IS NOT NULL THEN
    SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'public.investments'::regclass
      AND contype = 'c'
      AND conkey = ARRAY[v_attnum];
    IF v_conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.investments DROP CONSTRAINT %I', v_conname);
    END IF;
  END IF;
END $$;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_category_check
  CHECK (category IN ('produits','materiel','travaux','amenagement','logiciels','marketing','publicite','formation','consommables','autres'));

-- ---------------------------------------------------------------------------
-- 3b. record_stock_movement : synchronise aussi consumables.quantity quand la
--     fiche d'inventaire est liee a un consommable (meme pattern que product_id).
--     Re-creation complete de la fonction 00083 + bloc consommable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_organization_id uuid,
  p_inventory_id uuid,
  p_type text,
  p_quantity int,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
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

  INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, notes, reason, reference_type, reference_id, movement_date)
  VALUES (p_inventory_id, v_prod, p_organization_id, p_type, p_quantity, p_notes, p_reason, p_reference_type, p_reference_id, CURRENT_DATE)
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

GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, text, int, text, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Seed : produits d'entretien & consommables types pour chaque organisation
--    (stock 0 : le trigger cree les fiches d'inventaire associees).
-- ---------------------------------------------------------------------------
WITH seed(name, category, brand, unit, min_stock, cost, is_active) AS (
  VALUES
    -- Entretien
    ('Nettoyant multisurfaces 5L', 'entretien', 'Générique', 'L', 4, 850.00, true),
    ('Désinfectant sols 5L', 'entretien', 'Générique', 'L', 4, 950.00, true),
    ('Dégraissant 5L', 'entretien', 'Générique', 'L', 2, 1200.00, true),
    ('Nettoyant vitres 1L', 'entretien', 'Générique', 'L', 2, 450.00, true),
    ('Détartrant sanitaires 1L', 'sanitaire', 'Générique', 'L', 2, 500.00, true),
    ('Nettoyant chrome 750ml', 'entretien', 'Générique', 'piece', 1, 600.00, true),
    ('Produit moquette/tapis 5L', 'entretien', 'Générique', 'L', 1, 1800.00, true),
    ('Détergent lessive 5L', 'entretien', 'Générique', 'L', 2, 1100.00, true),
    -- Hygiène
    ('Gel hydroalcoolique 5L', 'hygiene', 'Générique', 'L', 2, 2500.00, true),
    ('Savon liquide 5L', 'hygiene', 'Générique', 'L', 4, 1400.00, true),
    ('Papier toilette (48 rouleaux)', 'hygiene', 'Générique', 'piece', 3, 3200.00, true),
    ('Essuie-mains papier (paquet)', 'hygiene', 'Générique', 'piece', 3, 2800.00, true),
    ('Spray désinfectant 750ml', 'hygiene', 'Générique', 'piece', 4, 380.00, true),
    ('Lingettes désinfectantes', 'hygiene', 'Générique', 'piece', 2, 550.00, true),
    ('Sacs poubelle (100)', 'sanitaire', 'Générique', 'piece', 5, 400.00, true),
    -- Sécurité / divers
    ('Gants latex (100)', 'securite', 'Générique', 'piece', 2, 900.00, true),
    ('Ampoules LED', 'bureau', 'Générique', 'piece', 4, 300.00, true),
    ('Piles AA (paquet)', 'bureau', 'Générique', 'piece', 2, 350.00, true),
    ('Piles AAA (paquet)', 'bureau', 'Générique', 'piece', 2, 350.00, true),
    ('Balai + serpillère', 'entretien', 'Générique', 'piece', 2, 1200.00, true),
    ('Chiffons microfibre (lot)', 'entretien', 'Générique', 'piece', 4, 700.00, true),
    ('Éponges (lot)', 'entretien', 'Générique', 'piece', 3, 250.00, true)
)
INSERT INTO consumables (organization_id, name, category, brand, unit, quantity, min_stock, cost, is_active)
SELECT o.id, s.name, s.category, s.brand, s.unit, 0, s.min_stock, s.cost, s.is_active
FROM organizations o
CROSS JOIN seed s
WHERE NOT EXISTS (
  SELECT 1 FROM consumables c
  WHERE c.organization_id = o.id AND lower(c.name) = lower(s.name)
);
