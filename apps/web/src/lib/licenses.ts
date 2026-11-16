export type LicenseSemaphoreTone = "green" | "amber" | "red" | "unknown";

export interface LicenseSemaphore {
  tone: LicenseSemaphoreTone;
  daysRemaining: number | null;
  label: string;
}

/**
 * Traffic-light evaluation of a nautical licence expiry date (YYYY-MM-DD).
 * green: > 90 days, amber: 31–90 days, red: <= 30 days or expired.
 */
export function evaluateLicenseSemaphore(expiry?: string | null): LicenseSemaphore {
  if (!expiry) {
    return { tone: "unknown", daysRemaining: null, label: "SIN FECHA" };
  }
  const expiryMs = new Date(`${expiry}T23:59:59`).getTime();
  if (Number.isNaN(expiryMs)) {
    return { tone: "unknown", daysRemaining: null, label: "FECHA INVÁLIDA" };
  }
  const days = Math.floor((expiryMs - Date.now()) / 86_400_000);
  if (days < 0) return { tone: "red", daysRemaining: days, label: "VENCIDA" };
  if (days <= 30) return { tone: "red", daysRemaining: days, label: `VENCE EN ${days}d` };
  if (days <= 90) return { tone: "amber", daysRemaining: days, label: `VENCE EN ${days}d` };
  return { tone: "green", daysRemaining: days, label: "VIGENTE" };
}

/** CSS helper class (see globals.css `.mo-tint-*`) for a semaphore tone. */
export function semaphoreTintClass(tone: LicenseSemaphoreTone): string {
  switch (tone) {
    case "green":
      return "mo-tint-ok";
    case "amber":
      return "mo-tint-warn";
    case "red":
      return "mo-tint-danger";
    default:
      return "mo-tint-muted";
  }
}
