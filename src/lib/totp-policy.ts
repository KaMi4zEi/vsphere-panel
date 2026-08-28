export function isTotpBypassActive(disabled: boolean, disabledUntil: Date | string | null | undefined, now = Date.now()) {
  if (!disabled || !disabledUntil) return false;
  const expiresAt = new Date(disabledUntil).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}
