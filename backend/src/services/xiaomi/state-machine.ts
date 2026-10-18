export enum XiaomiStateAction {
  SUCCESS = "SUCCESS",
  STOP_COOLDOWN = "STOP_COOLDOWN",
  STOP_QUOTA_EXHAUSTED = "STOP_QUOTA_EXHAUSTED",
  STOP_VERIFICATION_REQUIRED = "STOP_VERIFICATION_REQUIRED",
  RETRY_IMMEDIATE = "RETRY_IMMEDIATE",
  RETRY_AFTER_COOLDOWN = "RETRY_AFTER_COOLDOWN",
  ERROR = "ERROR",
}

export interface XiaomiApiResponse {
  code?: number;
  message?: string;
  data?: {
    applyResult?: number;
    buttonState?: number;
    deadlineFormat?: string;
    isPass?: boolean;
    [key: string]: any;
  };
}

export interface StateMachineEvaluation {
  action: XiaomiStateAction;
  applyResult?: number;
  isTerminal: boolean; // Terminal states require stopping sibling in-flight requests immediately
  delayMs?: number;
  message: string;
  diagnosticHint: string;
}

export function handleApplyResult(response: XiaomiApiResponse): StateMachineEvaluation {
  // If outer code is non-zero, treat as API-level failure
  if (response.code !== undefined && response.code !== 0) {
    return {
      action: XiaomiStateAction.ERROR,
      isTerminal: true,
      message: response.message || `Xiaomi API error code ${response.code}`,
      diagnosticHint: `API returned non-zero status code: ${response.code} (${response.message || "No error message"}). Verify session cookies or network connectivity.`,
    };
  }

  const applyResult = response.data?.apply_result ?? response.data?.applyResult;
  const deadline = response.data?.deadline_format ?? response.data?.deadlineFormat;

  switch (applyResult) {
    case 1:
      return {
        action: XiaomiStateAction.SUCCESS,
        applyResult: 1,
        isTerminal: true,
        message: "Application successful! Bootloader unlock quota granted.",
        diagnosticHint: "Quota token granted (passResult = 1). Device can now proceed with Mi Flash Unlock tool binding.",
      };

    case 2:
      return {
        action: XiaomiStateAction.STOP_COOLDOWN,
        applyResult: 2,
        isTerminal: true,
        message: "Monthly unlock limit or device binding cooldown active.",
        diagnosticHint: "Monthly unlock limit reached or 30-day device account binding cooldown is active. Wait until next month or use another account.",
      };

    case 3:
      return {
        action: XiaomiStateAction.STOP_QUOTA_EXHAUSTED,
        applyResult: 3,
        isTerminal: true,
        message: `Daily quota exhausted. Try again tomorrow at 23:00 WIB (00:00 GMT+8)${deadline ? ` (deadline: ${deadline})` : ""}.`,
        diagnosticHint: "Daily quota exhausted on server side. Next window opens at 00:00:00 GMT+8 (23:00:00 WIB).",
      };

    case 4:
      return {
        action: XiaomiStateAction.STOP_VERIFICATION_REQUIRED,
        applyResult: 4,
        isTerminal: true,
        message: "Verification cooldown or secondary verification required.",
        diagnosticHint: "Account in verification cooldown or requires phone/SMS verification in official mobile app.",
      };

    case 5:
      return {
        action: XiaomiStateAction.RETRY_IMMEDIATE,
        applyResult: 5,
        isTerminal: false,
        message: "Transient failure on Xiaomi server. Retrying with is_retry=true.",
        diagnosticHint: "Server returned transient error (code 5). Safe to retry immediately with payload is_retry=true.",
      };

    case 6:
      return {
        action: XiaomiStateAction.RETRY_AFTER_COOLDOWN,
        applyResult: 6,
        isTerminal: false,
        delayMs: 60000,
        message: "IP/Account frequency rate limited. Cooldown for 60 seconds before retrying.",
        diagnosticHint: "IP/Account frequency rate limited (code 6). Back off for 60 seconds. Consider configuring an outbound proxy.",
      };

    case 7:
      return {
        action: XiaomiStateAction.RETRY_IMMEDIATE,
        applyResult: 7,
        isTerminal: false,
        message: "Xiaomi server busy/temporary issue. Retrying with is_retry=true.",
        diagnosticHint: "Temporary server congestion (code 7). Safe to retry immediately with is_retry=true.",
      };

    default:
      return {
        action: XiaomiStateAction.ERROR,
        applyResult,
        isTerminal: true,
        message: `Unrecognized applyResult code: ${applyResult}`,
        diagnosticHint: `Unexpected applyResult code ${applyResult}. Inspect raw payload: ${JSON.stringify(response)}`,
      };
  }
}
