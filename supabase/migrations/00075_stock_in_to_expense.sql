-- 00075: Auto-create expense when stock movement type='in' is inserted
-- Expense = inventory.price × stock_movements.quantity

CREATE OR REPLACE FUNCTION sync_stock_movement_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_inv_name TEXT;
  v_amount DECIMAL(10,2);
BEGIN
  -- Only for 'in' movements
  IF NEW.type != 'in' THEN
    RETURN NEW;
  END IF;

  -- Look up inventory item (price, organization_id, name)
  SELECT id, price, organization_id, name
  INTO v_inv
  FROM inventory
  WHERE id = NEW.inventory_id;

  IF v_inv IS NULL OR v_inv.price IS NULL OR v_inv.price <= 0 THEN
    RETURN NEW;
  END IF;

  v_amount := v_inv.price * NEW.quantity;
  v_inv_name := COALESCE(v_inv.name, 'Article inconnu');

  -- Skip if expense already exists for this movement
  IF EXISTS (
    SELECT 1 FROM expenses
    WHERE reference_type = 'stock_movement' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Create expense
  INSERT INTO expenses (organization_id, category, description, amount, expense_date, created_by, reference_type, reference_id)
  VALUES (
    v_inv.organization_id,
    'products',
    'Achat stock - ' || v_inv_name || ' (' || NEW.quantity || ' × ' || v_inv.price || ' DA)',
    v_amount,
    CURRENT_DATE,
    NULL,
    'stock_movement',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also handle DELETE: remove linked expense
CREATE OR REPLACE FUNCTION cleanup_stock_movement_expense()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM expenses
  WHERE reference_type = 'stock_movement' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also handle UPDATE: if type changes or quantity changes, update expense
CREATE OR REPLACE FUNCTION update_stock_movement_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_amount DECIMAL(10,2);
BEGIN
  -- If type changed from 'in' to something else, delete expense
  IF OLD.type = 'in' AND NEW.type != 'in' THEN
    DELETE FROM expenses
    WHERE reference_type = 'stock_movement' AND reference_id = OLD.id;
    RETURN NEW;
  END IF;

  -- If type is still 'in' and quantity changed, update expense
  IF NEW.type = 'in' AND OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    SELECT price, organization_id, name INTO v_inv
    FROM inventory WHERE id = NEW.inventory_id;

    IF v_inv IS NOT NULL AND v_inv.price > 0 THEN
      v_amount := v_inv.price * NEW.quantity;
      UPDATE expenses
      SET amount = v_amount,
          description = 'Achat stock - ' || COALESCE(v_inv.name, 'Article inconnu') || ' (' || NEW.quantity || ' × ' || v_inv.price || ' DA)'
      WHERE reference_type = 'stock_movement' AND reference_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_stock_movement_to_expense ON stock_movements;
CREATE TRIGGER trg_sync_stock_movement_to_expense
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION sync_stock_movement_to_expense();

DROP TRIGGER IF EXISTS trg_cleanup_stock_movement_expense ON stock_movements;
CREATE TRIGGER trg_cleanup_stock_movement_expense
AFTER DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION cleanup_stock_movement_expense();

DROP TRIGGER IF EXISTS trg_update_stock_movement_expense ON stock_movements;
CREATE TRIGGER trg_update_stock_movement_expense
AFTER UPDATE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_stock_movement_expense();
