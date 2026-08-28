import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { badRequest, readJsonObject } from "@/lib/http";
import { isTotpBypassActive } from "@/lib/totp-policy";

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req);
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== "string" || typeof password !== "string" || email.length > 320 || password.length > 256) return badRequest("Requête invalide");
  const throttle = rateLimit(`totp-check:${await getClientIp(req.headers)}:${String(email).toLowerCase()}`, 5, 5 * 60_000);
  if (!throttle.allowed) return NextResponse.json(
    { error: "Trop de tentatives" },
    { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
  );
  const accountThrottle = rateLimit(`totp-check-account:${String(email).trim().toLowerCase()}`, 8, 5 * 60_000);
  if (!accountThrottle.allowed) return NextResponse.json({ error: "Trop de tentatives" }, { status: 429, headers: { "Retry-After": String(accountThrottle.retryAfter), "Cache-Control": "no-store" } });

  const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  const dummyHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9hQ7zE6HcYpC8VYVqS2jZ8oGmF5xY6u";
  const valid = await bcrypt.compare(password, user?.password ?? dummyHash);
  if (!user) return NextResponse.json({ valid: false }, { headers: { "Cache-Control": "no-store" } });
  if (!valid) return NextResponse.json({ valid: false }, { headers: { "Cache-Control": "no-store" } });

  return NextResponse.json({
    valid: true,
    needsTotp: user.totpEnabled && !isTotpBypassActive(user.totpDisabled, user.totpDisabledUntil),
  }, { headers: { "Cache-Control": "no-store" } });
}
