// src/lib/permissions.ts
// Gestion centralisée des rôles et permissions
import type { Session } from "next-auth";

export type Role = "ADMIN" | "MODERATOR" | "USER";

type SessionLike = Pick<Session, "user"> | null | undefined;

export function isAdmin(session: SessionLike): boolean {
  return session?.user?.role === "ADMIN";
}

export function isModerator(session: SessionLike): boolean {
  return session?.user?.role === "MODERATOR";
}

export function isAdminOrMod(session: SessionLike): boolean {
  return isAdmin(session) || isModerator(session);
}

// Vérifie si un rôle peut gérer un autre rôle
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "ADMIN") return true; // admin peut tout gérer
  if (actorRole === "MODERATOR") return targetRole === "USER"; // mod gère seulement les users
  return false;
}

// TOTP forcé pour USER et MODERATOR (pas ADMIN)
export function requiresTotp(role: Role): boolean {
  return role === "USER" || role === "MODERATOR";
}

export function canUseVM(role: Role, isInfrastructure: boolean, isAssigned: boolean): boolean {
  if (role === "ADMIN") return true;
  if (isInfrastructure) return false;
  if (role === "MODERATOR") return true;
  return isAssigned;
}
