// src/lib/settings.ts
import { prisma } from "@/lib/prisma";

let _cache: string | null = null;
let _cacheAt = 0;

export async function getSiteName(): Promise<string> {
  if (_cache && Date.now() - _cacheAt < 30_000) return _cache;
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  _cache = s?.siteName ?? "vSphere Panel";
  _cacheAt = Date.now();
  return _cache;
}

export function invalidateSiteNameCache() {
  _cache = null;
}
