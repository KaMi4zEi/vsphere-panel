import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";
function key() {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32 || secret.startsWith("CHANGEZ_MOI") || secret === process.env.NEXTAUTH_SECRET) {
    throw new Error("SETTINGS_ENCRYPTION_KEY doit contenir au moins 32 caractères et être distincte de NEXTAUTH_SECRET");
  }
  return createHash("sha256").update(secret).digest();
}
export function encryptSecret(value: string) {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptSecret(value?: string | null) {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  const payload = Buffer.from(value.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}
