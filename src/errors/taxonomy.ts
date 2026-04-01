export type AppErrorCode =
  | "CONFIG_MISSING"
  | "BASE_URL_MISSING"
  | "NETWORK_FAILURE"
  | "AUTH_FAILURE"
  | "RATE_LIMITED"
  | "TOOL_POLICY_BLOCKED"
  | "UNKNOWN";

export interface NormalizedAppError {
  code: AppErrorCode;
  message: string;
}

export function normalizeAppError(input: string | Error): NormalizedAppError {
  const message = typeof input === "string" ? input : input.message;
  const text = message.toLowerCase();
  if (text.includes("no configuration")) return { code: "CONFIG_MISSING", message };
  if (text.includes("base url")) return { code: "BASE_URL_MISSING", message };
  if (text.includes("401") || text.includes("unauthorized") || text.includes("api key")) {
    return { code: "AUTH_FAILURE", message };
  }
  if (text.includes("429") || text.includes("rate limit")) {
    return { code: "RATE_LIMITED", message };
  }
  if (text.includes("policy") || text.includes("not allowed")) {
    return { code: "TOOL_POLICY_BLOCKED", message };
  }
  if (text.includes("network") || text.includes("fetch")) {
    return { code: "NETWORK_FAILURE", message };
  }
  return { code: "UNKNOWN", message };
}

export function toDisplayError(input: string | Error): string {
  const err = normalizeAppError(input);
  return `[${err.code}] ${err.message}`;
}

