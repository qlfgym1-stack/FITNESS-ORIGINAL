-- Add action column to recovery_code_logs for per-action rate limiting
ALTER TABLE recovery_code_logs ADD COLUMN action TEXT NOT NULL DEFAULT 'send_code';

-- Update index to include action for faster per-action lookups
DROP INDEX IF EXISTS idx_recovery_code_logs_user;
CREATE INDEX idx_recovery_code_logs_user_action ON recovery_code_logs(user_id, action, attempted_at);
