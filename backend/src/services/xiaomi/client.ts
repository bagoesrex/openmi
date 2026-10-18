import { Account } from "../../domain/account";
import { XiaomiApiResponse } from "./state-machine";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; 23117PN0CG Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.88 Mobile Safari/537.36 XiaoMi/MiuiBrowser/4.3";

export function normalizeServiceToken(token: string): string {
  if (!token) return "";
  const trimmed = token.trim();
  return trimmed.includes("%") ? trimmed : encodeURIComponent(trimmed);
}

export function formatXiaomiHeaders(cUserId: string, serviceToken: string): Record<string, string> {
  const safeToken = normalizeServiceToken(serviceToken);
  return {
    "Cookie": `cUserId=${cUserId.trim()}; serviceToken=${safeToken}; new_bbs_serviceToken=${safeToken}`,
    "User-Agent": DEFAULT_USER_AGENT,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
  };
}

export function buildXiaomiUrl(region: string, path: string): string {
  const cleanRegion = (region || "global").trim().toLowerCase();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  let host = "https://sgp-api.buy.mi.com/bbs/api";
  if (cleanRegion === "ru") {
    host = "https://ru-api.buy.mi.com/bbs/api";
  } else if (cleanRegion === "eu" || cleanRegion === "es" || cleanRegion === "it" || cleanRegion === "fr" || cleanRegion === "de") {
    host = "https://ams-api.buy.mi.com/bbs/api";
  }

  return `${host}/${cleanRegion}/${cleanPath}`;
}

export interface RequestOptions {
  timeoutMs?: number;
  proxy?: string | null;
  signal?: AbortSignal;
}

export async function checkSwitchValue(
  region: string = "global",
  options?: RequestOptions
): Promise<XiaomiApiResponse> {
  const url = buildXiaomiUrl(region, "bl-switch/value");
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "application/json, text/plain, */*",
  };

  const fetchOptions: any = {
    method: "GET",
    headers,
    signal: options?.signal || AbortSignal.timeout(options?.timeoutMs || 5000),
  };

  if (options?.proxy) {
    fetchOptions.proxy = options.proxy;
  }

  const res = await fetch(url, fetchOptions);
  return await res.json() as XiaomiApiResponse;
}

export async function checkUserState(
  account: Account,
  options?: RequestOptions
): Promise<XiaomiApiResponse> {
  const url = buildXiaomiUrl(account.region, "user/bl-switch/state");
  const headers = formatXiaomiHeaders(account.cUserId, account.serviceToken);

  const fetchOptions: any = {
    method: "GET",
    headers,
    signal: options?.signal || AbortSignal.timeout(options?.timeoutMs || 5000),
  };

  if (options?.proxy || account.proxyUrl) {
    fetchOptions.proxy = options?.proxy || account.proxyUrl;
  }

  const res = await fetch(url, fetchOptions);
  return await res.json() as XiaomiApiResponse;
}

export async function applyBlAuth(
  account: Account,
  isRetry: boolean = false,
  options?: RequestOptions
): Promise<XiaomiApiResponse> {
  const url = buildXiaomiUrl(account.region, "apply/bl-auth");
  const headers = formatXiaomiHeaders(account.cUserId, account.serviceToken);
  const body = JSON.stringify({ is_retry: isRetry });

  const fetchOptions: any = {
    method: "POST",
    headers,
    body,
    signal: options?.signal || AbortSignal.timeout(options?.timeoutMs || 5000),
  };

  if (options?.proxy || account.proxyUrl) {
    fetchOptions.proxy = options?.proxy || account.proxyUrl;
  }

  const res = await fetch(url, fetchOptions);
  return await res.json() as XiaomiApiResponse;
}
