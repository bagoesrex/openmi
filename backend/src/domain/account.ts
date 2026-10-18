export interface Account {
  id: string;
  label: string;
  region: string;
  cUserId: string;
  serviceToken: string;
  deviceId?: string | null;
  proxyUrl?: string | null;
  sessionValid: number; // 1 = valid, 0 = invalid/expired
  lastButtonState?: number | null;
  lastApplyResult?: number | null;
  autoApplyEnabled: number; // 1 = true, 0 = false
  createdAt: string;
  updatedAt: string;
}

export interface NewAccount {
  label: string;
  region?: string;
  cUserId: string;
  serviceToken: string;
  deviceId?: string | null;
  proxyUrl?: string | null;
  autoApplyEnabled?: number;
}
