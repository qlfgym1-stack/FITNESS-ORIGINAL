-- Fix investments.created_by FK: add ON DELETE SET NULL
-- Without this, deleteUser() fails when the user has created investment rows
ALTER TABLE investments
  DROP CONSTRAINT IF EXISTS investments_created_by_fkey,
  ADD CONSTRAINT investments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
