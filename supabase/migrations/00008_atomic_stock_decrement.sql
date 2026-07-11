-- Atomic stock decrement for POS checkout (prevents overselling)
CREATE OR REPLACE FUNCTION decrement_product_stock(p_id UUID, p_qty INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock = stock - p_qty
  WHERE id = p_id AND stock >= p_qty;
  RETURN FOUND;
END;
$$;