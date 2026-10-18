export interface ExecutionLog {
  id: number;
  accountId?: string | null;
  timestamp: number; // Unix ms
  action: string;    // 'CHECK_STATE' | 'APPLY' | 'RETRY' | 'TLS_PREWARM'
  resultCode?: number | null;
  message?: string | null;
  rawPayload?: string | null;
  errorDetails?: string | null; // Detailed diagnostic info for AI agents
}

export interface NewLog {
  accountId?: string | null;
  timestamp: number;
  action: string;
  resultCode?: number | null;
  message?: string | null;
  rawPayload?: string | null;
  errorDetails?: string | null;
}
