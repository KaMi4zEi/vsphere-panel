import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/lib/secrets";
import { rateLimit } from "../src/lib/rate-limit";
import { canManageRole, canUseVM, requiresTotp } from "../src/lib/permissions";
import { readJsonObject } from "../src/lib/http";
import { generate, generateSecret, generateURI, verify } from "otplib";
import { validateFaviconDataUrl } from "../src/lib/favicon";
import { generateTemporaryPassword, passwordPolicyError } from "../src/lib/password-policy";
import { isTotpBypassActive } from "../src/lib/totp-policy";

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

describe("protection des secrets", () => {
  beforeEach(() => { process.env.SETTINGS_ENCRYPTION_KEY = "test-key-that-is-long-and-unique"; });
  it("chiffre puis déchiffre une valeur", () => {
    const encrypted = encryptSecret("smtp-password");
    expect(encrypted).not.toContain("smtp-password");
    expect(decryptSecret(encrypted)).toBe("smtp-password");
  });
});

describe("limitation de débit", () => {
  it("refuse les appels au-delà de la limite", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(rateLimit(key, 2).allowed).toBe(true);
    expect(rateLimit(key, 2).allowed).toBe(true);
    expect(rateLimit(key, 2).allowed).toBe(false);
  });
});

describe("permissions par rôle", () => {
  it("permet à un administrateur de gérer et d'attribuer tous les rôles", () => {
    expect(canManageRole("ADMIN", "USER")).toBe(true);
    expect(canManageRole("ADMIN", "MODERATOR")).toBe(true);
    expect(canManageRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("empêche un modérateur de gérer les rôles privilégiés", () => {
    expect(canManageRole("MODERATOR", "USER")).toBe(true);
    expect(canManageRole("MODERATOR", "MODERATOR")).toBe(false);
    expect(canManageRole("MODERATOR", "ADMIN")).toBe(false);
  });

  it("impose le TOTP aux utilisateurs et modérateurs", () => {
    expect(requiresTotp("USER")).toBe(true);
    expect(requiresTotp("MODERATOR")).toBe(true);
    expect(requiresTotp("ADMIN")).toBe(false);
  });

  it("réserve toujours les VM d’infrastructure aux administrateurs", () => {
    expect(canUseVM("ADMIN", true, false)).toBe(true);
    expect(canUseVM("MODERATOR", true, true)).toBe(false);
    expect(canUseVM("USER", true, true)).toBe(false);
  });

  it("conserve l'accès global des rôles privilégiés et l'accès attribué des utilisateurs", () => {
    expect(canUseVM("MODERATOR", false, false)).toBe(true);
    expect(canUseVM("USER", false, true)).toBe(true);
    expect(canUseVM("USER", false, false)).toBe(false);
  });
});

describe("lecture JSON", () => {
  it("refuse les tableaux et les contenus invalides", async () => {
    expect(await readJsonObject(new Request("http://localhost", { method: "POST", body: "[]" }))).toBeNull();
    expect(await readJsonObject(new Request("http://localhost", { method: "POST", body: "invalid" }))).toBeNull();
  });

  it("refuse un corps déclaré au-delà de la limite", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "1000001" },
      body: "{}",
    });
    expect(await readJsonObject(request)).toBeNull();
  });
});

describe("favicons SVG", () => {
  it("accepte un SVG graphique autonome", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#2563eb" d="M0 0h32v32H0z"/></svg>';
    expect(validateFaviconDataUrl(svgDataUrl(svg), "image/svg+xml")?.mimeType).toBe("image/svg+xml");
  });

  it("refuse les scripts, événements et ressources externes", () => {
    const script = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const event = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
    const external = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test/a.png"/></svg>';
    expect(validateFaviconDataUrl(svgDataUrl(script), "image/svg+xml")).toBeNull();
    expect(validateFaviconDataUrl(svgDataUrl(event), "image/svg+xml")).toBeNull();
    expect(validateFaviconDataUrl(svgDataUrl(external), "image/svg+xml")).toBeNull();
  });
});

describe("politique de mot de passe", () => {
  it("refuse un mot de passe composé uniquement de chiffres", () => {
    expect(passwordPolicyError("123456789012")).not.toBeNull();
  });

  it("accepte un mot de passe long et diversifié", () => {
    expect(passwordPolicyError("Panel-Vsphere-2026!" )).toBeNull();
  });

  it("génère des mots de passe temporaires conformes", () => {
    for (let index = 0; index < 20; index++) expect(passwordPolicyError(generateTemporaryPassword())).toBeNull();
  });
});

describe("TOTP", () => {
  it("n'active une dérogation que jusqu'à sa date d'expiration", () => {
    const now = Date.now();
    expect(isTotpBypassActive(true, new Date(now + 60_000), now)).toBe(true);
    expect(isTotpBypassActive(true, new Date(now - 1), now)).toBe(false);
    expect(isTotpBypassActive(false, new Date(now + 60_000), now)).toBe(false);
  });

  it("génère et vérifie un code compatible avec une URI d’authentificateur", async () => {
    const secret = generateSecret();
    const uri = generateURI({ issuer: "vSphere Panel", label: "admin@example.test", secret });
    const token = await generate({ secret });
    const result = await verify({ secret, token, epochTolerance: 30 });

    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(result.valid).toBe(true);
  });
});
