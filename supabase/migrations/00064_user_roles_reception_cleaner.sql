-- Migration 00064: Ajout des rôles réceptionniste et agent de nettoyage
-- Rôles possibles : 'admin' / 'coach' / 'staff' / 'receptionist' / 'cleaner'

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'coach', 'staff', 'receptionist', 'cleaner'));
