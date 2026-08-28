import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, readJsonObject } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { passwordPolicyError } from "@/lib/password-policy";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const setupRequired = await prisma.user.count() === 0;
  return NextResponse.json({ setupRequired }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expectedHost = request.headers.get("host");
  if (origin) {
    try {
      if (!expectedHost || new URL(origin).host !== expectedHost) {
        return NextResponse.json({ error: "Origine de la requête refusée" }, { status: 403, headers: noStore });
      }
    } catch {
      return NextResponse.json({ error: "Origine de la requête refusée" }, { status: 403, headers: noStore });
    }
  }

  const throttle = rateLimit(`initial-setup:${await getClientIp(request.headers)}`, 5, 15 * 60_000);
  if (!throttle.allowed) {
    return NextResponse.json({ error: "Trop de tentatives" }, {
      status: 429,
      headers: { ...noStore, "Retry-After": String(throttle.retryAfter) },
    });
  }

  const body = await readJsonObject(request);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body?.password;
  const policyError = passwordPolicyError(password);

  if (username.length < 2 || username.length > 80 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
      policyError) {
    return badRequest(policyError ?? "Nom ou email invalide");
  }

  const validPassword = password as string;
  const passwordHash = await bcrypt.hash(validPassword, 12);
  try {
    await prisma.$transaction(async transaction => {
      // Le niveau SERIALIZABLE garantit qu’un seul premier compte peut être créé.
      if (await transaction.user.count() !== 0) throw new Error("SETUP_ALREADY_COMPLETED");
      await transaction.user.create({
        data: {
          username,
          email,
          password: passwordHash,
          role: Role.ADMIN,
          totpForced: false,
          mustChangePassword: false,
        },
      });
      await transaction.siteSettings.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", siteName: "vSphere Panel" },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_ALREADY_COMPLETED") {
      return NextResponse.json({ error: "La configuration initiale est déjà terminée" }, { status: 409, headers: noStore });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: "La configuration initiale vient d’être terminée" }, { status: 409, headers: noStore });
    }
    console.error("[setup] initial account creation failed", error);
    return NextResponse.json({ error: "Impossible de créer le compte administrateur" }, { status: 500, headers: noStore });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
}
