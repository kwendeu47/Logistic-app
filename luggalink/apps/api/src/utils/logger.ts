const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "authorization",
  "token",
  "jwt",
  "stripePaymentIntentId",
  "stripeClientSecret",
  "client_secret",
  "ssn",
  "qrSealCode",
  "scannedQrCode",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redact(nested, depth + 1);
  }
  return redacted;
}

export function logError(message: string, error?: unknown, context?: Record<string, unknown>): void {
  const safeError = error instanceof Error ? { message: error.message, name: error.name } : redact(error);
  console.error(message, safeError, context ? redact(context) : undefined);
}
