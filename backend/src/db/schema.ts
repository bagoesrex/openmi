export const schemaSql = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'global',
  c_user_id TEXT NOT NULL,
  service_token TEXT NOT NULL,
  device_id TEXT,
  proxy_url TEXT,
  session_valid INTEGER DEFAULT 1,
  last_button_state INTEGER,
  last_apply_result INTEGER,
  auto_apply_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  result_code INTEGER,
  message TEXT,
  raw_payload TEXT,
  error_details TEXT,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON execution_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_account ON execution_logs(account_id);
`;
