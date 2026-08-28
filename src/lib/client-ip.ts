import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

function validIps(value: string | null) {
  return (value ?? "").split(",").map(ip => ip.trim()).filter(ip => Boolean(isIP(ip)));
}

export async function getClientIp(headers: Headers) {
  const forwarded = validIps(headers.get("x-forwarded-for"));
  const cloudflare = validIps(headers.get("cf-connecting-ip"))[0];
  const realIp = validIps(headers.get("x-real-ip"))[0];
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" }, select: { trustedProxyIps: true } }).catch(() => null);
  const trusted = validIps(settings?.trustedProxyIps ?? null);

  // Compatibilité d'initialisation : en l'absence de configuration, conserver
  // le comportement historique. Le pare-feu doit alors interdire l'accès direct.
  if (trusted.length === 0) {
    return cloudflare ?? realIp ?? forwarded[0] ?? "unknown";
  }

  // Si une chaîne complète contient les proxys, la parcourir de droite à gauche.
  if (forwarded.length > 1 && trusted.includes(forwarded.at(-1)!)) {
    let index = forwarded.length - 1;
    while (index >= 0 && trusted.includes(forwarded[index])) index--;
    if (index >= 0) return forwarded[index];
  }

  // Nginx Proxy Manager transmet normalement l'adresse déjà normalisée dans
  // CF-Connecting-IP/X-Real-IP et ne s'ajoute pas lui-même à X-Forwarded-For.
  // L'accès direct au port applicatif doit être interdit par le pare-feu.
  return cloudflare ?? realIp ?? forwarded[0] ?? "unknown";
}
