-- Recovery Codes for Admin Account Recovery
CREATE TABLE recovery_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

-- Recovery code usage log
CREATE TABLE recovery_code_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE recovery_code_logs ENABLE ROW LEVEL SECURITY;

-- Only the user can read their own recovery code metadata (never the code itself)
CREATE POLICY "Users can view their own recovery code" ON recovery_codes
  FOR SELECT USING (user_id = auth.uid());

-- Only the user can insert their own recovery code
CREATE POLICY "Users can insert their own recovery code" ON recovery_codes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Only the user can update their own recovery code (used when regenerating after recovery)
CREATE POLICY "Users can update their own recovery code" ON recovery_codes
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can do all operations (needed by edge function for unauthenticated recovery)
CREATE POLICY "Service role can manage recovery codes" ON recovery_codes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own recovery logs
CREATE POLICY "Users can view their own recovery logs" ON recovery_code_logs
  FOR SELECT USING (user_id = auth.uid());

-- Service role can insert recovery logs
CREATE POLICY "Service role can insert recovery logs" ON recovery_code_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Index for faster lookups
CREATE INDEX idx_recovery_code_logs_user ON recovery_code_logs(user_id);
CREATE INDEX idx_recovery_code_logs_attempted ON recovery_code_logs(attempted_at);
