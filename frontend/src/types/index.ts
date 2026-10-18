export interface Account {
  id: string;
  label: string;
  region: string;
  cUserId: string;
  serviceToken: string;
  deviceId?: string | null;
  proxyUrl?: string | null;
  sessionValid: number; // 1 = valid, 0 = invalid
  lastButtonState?: number | null;
  lastApplyResult?: number | null;
  autoApplyEnabled: number; // 1 = true, 0 = false
  createdAt: string;
  updatedAt: string;
}

export interface NewAccountInput {
  label: string;
  region: string;
  cUserId: string;
  serviceToken: string;
  deviceId?: string | null;
  proxyUrl?: string | null;
  autoApplyEnabled?: boolean;
}

export interface ExecutionLog {
  id: number;
  accountId?: string | null;
  timestamp: number;
  action: string;
  resultCode?: number | null;
  message?: string | null;
  rawPayload?: string | null;
  errorDetails?: string | null;
}
