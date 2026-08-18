-- Composite indexes for hot query paths (dashboard, members, POS)
-- These cover the most common multi-column filter patterns

-- Members filtered by org + status (used in members.tsx, classes.tsx)
CREATE INDEX IF NOT EXISTS idx_members_org_status ON members(organization_id, status);

-- Subscriptions filtered by org + status + end_date (used in dashboard)
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status_end ON member_subscriptions(organization_id, status, end_date);

-- Payments filtered by org + status + date (used in dashboard)
CREATE INDEX IF NOT EXISTS idx_payments_org_status_date ON payments(organization_id, status, payment_date);

-- POS transactions filtered by org + payment_status + date (used in dashboard)
CREATE INDEX IF NOT EXISTS idx_pos_tx_org_status_date ON pos_transactions(organization_id, payment_status, created_at);

-- Stock movements filtered by org (used in inventory.tsx, stock.tsx)
CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON stock_movements(organization_id, created_at);

-- Expenses filtered by org + category (used in expenses.tsx, assistant-comptable)
CREATE INDEX IF NOT EXISTS idx_expenses_org_category ON expenses(organization_id, category);
