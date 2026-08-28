import { randomInt } from "crypto";

export const PASSWORD_REQUIREMENTS = "12 caractères minimum, avec une minuscule, une majuscule, un chiffre et un caractère spécial";

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) return PASSWORD_REQUIREMENTS;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return PASSWORD_REQUIREMENTS;
  return null;
}

export function generateTemporaryPassword(length = 16): string {
  const groups = ["abcdefghjkmnpqrstuvwxyz", "ABCDEFGHJKMNPQRSTUVWXYZ", "23456789", "!@#$%*-_+"];
  const chars = groups.join("");
  const password = [
    ...groups.map(group => group[randomInt(group.length)]),
    ...Array.from({ length: Math.max(0, length - groups.length) }, () => chars[randomInt(chars.length)]),
  ];
  for (let index = password.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }
  return password.join("");
}
