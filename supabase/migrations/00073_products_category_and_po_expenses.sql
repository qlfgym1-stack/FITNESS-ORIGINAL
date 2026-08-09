-- 00073: Replace "other" → "products" in expenses + auto-sync purchase_orders → expenses

-- 1. Drop old CHECK constraint and add new one with 'products' instead of 'other'
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN ('rent','salaries','electricity','water','equipment','maintenance','marketing','insurance','taxes','products'));

-- 2. Backfill existing data
UPDATE expenses SET category = 'products' WHERE category = 'other';

-- 3. Function: auto-create expense when purchase_order is received
CREATE OR REPLACE FUNCTION sync_purchase_order_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_name TEXT;
BEGIN
  -- Only create expense when status changes to 'received'
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    -- Look up supplier name
    SELECT name INTO v_supplier_name FROM suppliers WHERE id = NEW.supplier_id;
    v_supplier_name := COALESCE(v_supplier_name, 'Fournisseur inconnu');

    -- Create expense entry (skip if already exists)
    IF NOT EXISTS (
      SELECT 1 FROM expenses
      WHERE reference_type = 'purchase_order' AND reference_id = NEW.id
    ) THEN
      INSERT INTO expenses (organization_id, category, description, amount, expense_date, created_by, reference_type, reference_id)
      VALUES (
        NEW.organization_id,
        'products',
        'Achat - ' || v_supplier_name || ' (BC #' || LEFT(NEW.id::text, 8) || ')',
        COALESCE(NEW.total_amount, 0),
        CURRENT_DATE,
        NULL,
        'purchase_order',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_purchase_order_to_expense ON purchase_orders;
CREATE TRIGGER trg_sync_purchase_order_to_expense
AFTER UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION sync_purchase_order_to_expense();

-- 4. Backfill: create expenses for already-received purchase orders
INSERT INTO expenses (organization_id, category, description, amount, expense_date, reference_type, reference_id)
SELECT
  po.organization_id,
  'products',
  'Achat - ' || COALESCE(s.name, 'Fournisseur inconnu') || ' (BC #' || LEFT(po.id::text, 8) || ')',
  COALESCE(po.total_amount, 0),
  po.order_date,
  'purchase_order',
  po.id
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po.supplier_id
WHERE po.status = 'received'
  AND NOT EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.reference_type = 'purchase_order' AND e.reference_id = po.id
  );
