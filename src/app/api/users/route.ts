import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isAdminOrMod, requiresTotp, type Role } from "@/lib/permissions";
import { badRequest, readJsonObject } from "@/lib/http";
import bcrypt from "bcryptjs";
import { passwordPolicyError } from "@/lib/password-policy";
import { Prisma } from "@prisma/client";
import { isTotpBypassActive } from "@/lib/totp-policy";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, createdAt: true, totpEnabled: true, totpDisabled: true, totpDisabledUntil: true, _count: { select: { assignments: { where: { vm: { isInfra: false } } } } } },
    orderBy: { createdAt: "desc" },
  });

  // Un modérateur ne voit que les comptes qu’il est autorisé à gérer.
  const role = (session as any)?.user?.role;
  const effectiveUsers = users.map(user => ({ ...user, totpDisabled: isTotpBypassActive(user.totpDisabled, user.totpDisabledUntil) }));
  const filtered = role === "MODERATOR" ? effectiveUsers.filter(u => u.role === "USER") : effectiveUsers;
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminOrMod(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJsonObject(req);
  if (!body) return badRequest();
  const { username, email, password, role, mustChangePassword } = body;

  if (!username || !email || !password) return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  if (typeof username !== "string" || username.trim().length < 2 || username.length > 80 ||
      typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      passwordPolicyError(password) ||
      (role !== undefined && (typeof role !== "string" || !["ADMIN", "MODERATOR", "USER"].includes(role))) ||
      (mustChangePassword !== undefined && typeof mustChangePassword !== "boolean")) {
    return NextResponse.json({ error: passwordPolicyError(password) ?? "Données invalides" }, { status: 400 });
  }

  const actorRole = (session as any)?.user?.role;
  // Modérateur ne peut créer que des USER
  if (actorRole === "MODERATOR" && role && role !== "USER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Seul admin peut créer des admins ou modérateurs
  if (!isAdmin(session) && (role === "ADMIN" || role === "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] } });
  if (existing) return NextResponse.json({ error: "Email ou username déjà utilisé" }, { status: 409 });

  const hash = await bcrypt.hash(password as string, 12);
  const newRole = (role ?? "USER") as Role;
  let user;
  try {
    user = await prisma.user.create({
      data: { username: normalizedUsername, email: normalizedEmail, password: hash, role: newRole, totpForced: requiresTotp(newRole), mustChangePassword: isAdmin(session) ? mustChangePassword !== false : true },
      select: { id: true, username: true, email: true, role: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Email ou username déjà utilisé" }, { status: 409 });
    throw error;
  }

  await writeAuditLog({ action: "USER_CREATED", session, targetType: "user", targetId: user.id, targetLabel: user.username, details: `Rôle : ${user.role}` });
  return NextResponse.json(user, { status: 201 });
}
