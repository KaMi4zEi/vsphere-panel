import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateFaviconDataUrl } from "@/lib/favicon";

const safeImageHeaders = {
  "Cache-Control": "no-cache, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; style-src 'none'; sandbox",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  try {
    const s = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
    if (s?.faviconData && s.faviconType) {
      const favicon = validateFaviconDataUrl(s.faviconData, s.faviconType);
      if (favicon) {
        const body = Uint8Array.from(favicon.buffer);
        return new NextResponse(body, {
          headers: {
            ...safeImageHeaders,
            "Content-Type": favicon.mimeType,
          },
        });
      }
    }
  } catch {}
  const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2563eb"/><rect x="13" y="20" width="38" height="25" rx="4" fill="none" stroke="white" stroke-width="4"/><circle cx="22" cy="32.5" r="4" fill="white"/><path d="M31 28h14M31 36h14" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>`;
  return new NextResponse(fallback, {
    headers: {
      ...safeImageHeaders,
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
