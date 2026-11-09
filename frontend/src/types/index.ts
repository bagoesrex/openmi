export type TimingMode = "asia" | "europe" | "single" | "custom";

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
  timingMode?: TimingMode;
  customTimings?: string | null;
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
  timingMode?: TimingMode;
  customTimings?: string | null;
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

export interface QrSessionResponse {
  sessionId: string;
  qrUrl: string;
  timeout: number;
}

export type QrPollStatus = "WAITING" | "SCANNED" | "SUCCESS" | "EXPIRED" | "ERROR";

export interface QrStatusResponse {
  status: QrPollStatus;
  cUserId?: string;
  serviceToken?: string;
  error?: string;
}
