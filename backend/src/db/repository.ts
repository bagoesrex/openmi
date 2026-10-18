import { Database } from "bun:sqlite";
import { Account, NewAccount } from "../domain/account";
import { ExecutionLog, NewLog } from "../domain/log";

export interface AccountRepository {
  getAll(): Account[];
  getById(id: string): Account | null;
  getEnabled(): Account[];
  create(data: NewAccount): Account;
  update(id: string, data: Partial<Account>): Account | null;
  delete(id: string): boolean;
}

export interface LogRepository {
  insert(log: NewLog): void;
  getRecent(limit?: number): ExecutionLog[];
  getByAccount(accountId: string, limit?: number): ExecutionLog[];
  clearOlderThan(timestamp: number): void;
}

function mapRowToAccount(row: any): Account {
  return {
    id: row.id,
    label: row.label,
    region: row.region,
    cUserId: row.c_user_id,
    serviceToken: row.service_token,
    deviceId: row.device_id,
    proxyUrl: row.proxy_url,
    sessionValid: row.session_valid,
    lastButtonState: row.last_button_state,
    lastApplyResult: row.last_apply_result,
    autoApplyEnabled: row.auto_apply_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToLog(row: any): ExecutionLog {
  return {
    id: row.id,
    accountId: row.account_id,
    timestamp: row.timestamp,
    action: row.action,
    resultCode: row.result_code,
    message: row.message,
    rawPayload: row.raw_payload,
    errorDetails: row.error_details,
  };
}

export function createAccountRepo(db: Database): AccountRepository {
  const selectAllStmt = db.prepare("SELECT * FROM accounts ORDER BY created_at ASC");
  const selectByIdStmt = db.prepare("SELECT * FROM accounts WHERE id = ?");
  const selectEnabledStmt = db.prepare("SELECT * FROM accounts WHERE auto_apply_enabled = 1");
  const insertStmt = db.prepare(`
    INSERT INTO accounts (id, label, region, c_user_id, service_token, device_id, proxy_url, auto_apply_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const deleteStmt = db.prepare("DELETE FROM accounts WHERE id = ?");

  return {
    getAll(): Account[] {
      return selectAllStmt.all().map(mapRowToAccount);
    },
    getById(id: string): Account | null {
      const row = selectByIdStmt.get(id);
      return row ? mapRowToAccount(row) : null;
    },
    getEnabled(): Account[] {
      return selectEnabledStmt.all().map(mapRowToAccount);
    },
    create(data: NewAccount): Account {
      const id = crypto.randomUUID();
      const region = data.region || "global";
      const autoApply = data.autoApplyEnabled !== undefined ? data.autoApplyEnabled : 1;
      insertStmt.run(
        id,
        data.label,
        region,
        data.cUserId,
        data.serviceToken,
        data.deviceId || null,
        data.proxyUrl || null,
        autoApply
      );
      return selectByIdStmt.get(id) as unknown as Account && mapRowToAccount(selectByIdStmt.get(id));
    },
    update(id: string, data: Partial<Account>): Account | null {
      const existing = selectByIdStmt.get(id) as any;
      if (!existing) return null;

      const fields: string[] = [];
      const values: any[] = [];

      if (data.label !== undefined) { fields.push("label = ?"); values.push(data.label); }
      if (data.region !== undefined) { fields.push("region = ?"); values.push(data.region); }
      if (data.cUserId !== undefined) { fields.push("c_user_id = ?"); values.push(data.cUserId); }
      if (data.serviceToken !== undefined) { fields.push("service_token = ?"); values.push(data.serviceToken); }
      if (data.deviceId !== undefined) { fields.push("device_id = ?"); values.push(data.deviceId); }
      if (data.proxyUrl !== undefined) { fields.push("proxy_url = ?"); values.push(data.proxyUrl); }
      if (data.sessionValid !== undefined) { fields.push("session_valid = ?"); values.push(data.sessionValid); }
      if (data.lastButtonState !== undefined) { fields.push("last_button_state = ?"); values.push(data.lastButtonState); }
      if (data.lastApplyResult !== undefined) { fields.push("last_apply_result = ?"); values.push(data.lastApplyResult); }
      if (data.autoApplyEnabled !== undefined) { fields.push("auto_apply_enabled = ?"); values.push(data.autoApplyEnabled); }

      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      const updateSql = `UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`;
      db.prepare(updateSql).run(...values);
      return mapRowToAccount(selectByIdStmt.get(id));
    },
    delete(id: string): boolean {
      const result = deleteStmt.run(id);
      return result.changes > 0;
    },
  };
}

export function createLogRepo(db: Database): LogRepository {
  const insertStmt = db.prepare(`
    INSERT INTO execution_logs (account_id, timestamp, action, result_code, message, raw_payload, error_details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const selectRecentStmt = db.prepare("SELECT * FROM execution_logs ORDER BY timestamp DESC LIMIT ?");
  const selectByAccountStmt = db.prepare("SELECT * FROM execution_logs WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?");
  const deleteOlderStmt = db.prepare("DELETE FROM execution_logs WHERE timestamp < ?");

  return {
    insert(log: NewLog): void {
      insertStmt.run(
        log.accountId || null,
        log.timestamp,
        log.action,
        log.resultCode ?? null,
        log.message || null,
        log.rawPayload || null,
        log.errorDetails || null
      );
    },
    getRecent(limit: number = 100): ExecutionLog[] {
      return selectRecentStmt.all(limit).map(mapRowToLog);
    },
    getByAccount(accountId: string, limit: number = 100): ExecutionLog[] {
      return selectByAccountStmt.all(accountId, limit).map(mapRowToLog);
    },
    clearOlderThan(timestamp: number): void {
      deleteOlderStmt.run(timestamp);
    },
  };
}
