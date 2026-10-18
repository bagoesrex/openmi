import type { Account, ExecutionLog, NewAccountInput } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function getHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const activeToken = token || localStorage.getItem("openmi_token");
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }
  return headers;
}

export async function login(password: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || "Login failed");
  }

  return res.json();
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    throw new Error("Failed to fetch accounts");
  }

  return res.json();
}

export async function createAccount(input: NewAccountInput): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to create account");
  return res.json();
}

export async function updateAccount(id: string, input: Partial<NewAccountInput>): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/accounts/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to update account");
  return res.json();
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/accounts/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) throw new Error("Failed to delete account");
}

export async function testAccountConnection(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/accounts/${id}/test`, {
    method: "POST",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Connection test failed");
  }

  return res.json();
}

export async function fetchRecentLogs(limit: number = 50): Promise<ExecutionLog[]> {
  const res = await fetch(`${API_BASE}/api/logs?limit=${limit}`, {
    headers: getHeaders(),
  });

  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export async function clearAllLogs(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) throw new Error("Failed to clear logs on server");
}

export function getSSEUrl(token?: string | null): string {
  const activeToken = token || localStorage.getItem("openmi_token");
  return `${API_BASE}/api/logs/stream?token=${encodeURIComponent(activeToken || "")}`;
}
