import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateSiteNameCache } from "@/lib/settings";
import { badRequest, readJsonObject } from "@/lib/http";
import { validateFaviconDataUrl } from "@/lib/favicon";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET() {
  const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ siteName: s?.siteName ?? "", hasFavicon: !!s?.faviconData });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJsonObject(req);
  if (!body) return badRequest();
  const { siteName, faviconData, faviconType, removeFavicon } = body;
  if (removeFavicon !== undefined && typeof removeFavicon !== "boolean") return badRequest();

  const updateData: Prisma.SiteSettingsUpdateInput = {};
  if (siteName !== undefined) {
    if (typeof siteName !== "string" || siteName.trim().length > 80) return NextResponse.json({ error: "Nom de site invalide" }, { status: 400 });
    updateData.siteName = siteName.trim() || "vSphere Panel";
  }
  if (faviconData) {
    const validated = validateFaviconDataUrl(faviconData, faviconType);
    if (!validated || typeof faviconData !== "string") {
      return NextResponse.json({ error: "Favicon invalide" }, { status: 400 });
    }
    updateData.faviconData = faviconData;
    updateData.faviconType = validated.mimeType;
  }
  if (removeFavicon) { updateData.faviconData = null; updateData.faviconType = null; }

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: updateData,
    create: { id: "singleton", siteName: siteName || "vSphere Panel" },
  });

  invalidateSiteNameCache();
  await writeAuditLog({ action: "SITE_SETTINGS_CHANGED", session, visibility: "ADMIN_ONLY", targetType: "settings", targetLabel: "Identité du site" });
  return NextResponse.json({ ok: true });
}
