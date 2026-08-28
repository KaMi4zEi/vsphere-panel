// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { decryptSecret } from "@/lib/secrets";
import { isTotpBypassActive } from "@/lib/totp-policy";
import { getClientIp } from "@/lib/client-ip";
import { writeAuditLog } from "@/lib/audit-log";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        totpCode: { label: "Code TOTP", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        if (email.length > 320 || credentials.password.length > 256 || (credentials.totpCode && !/^\d{6}$/.test(credentials.totpCode))) return null;
        const requestHeaders = new Headers();
        for (const [name, value] of Object.entries(request.headers ?? {})) {
          if (typeof value === "string") requestHeaders.set(name, value);
          else if (Array.isArray(value)) requestHeaders.set(name, value.join(","));
        }
        const ip = await getClientIp(requestHeaders);
        if (!rateLimit(`login-ip:${ip}`, 30, 5 * 60_000).allowed) return null;
        if (!rateLimit(`login-account:${email}`, 8, 5 * 60_000).allowed) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        const dummyHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9hQ7zE6HcYpC8VYVqS2jZ8oGmF5xY6u";
        const valid = await bcrypt.compare(credentials.password, user?.password ?? dummyHash);
        if (!user) return null;
        if (!valid) return null;

        // TOTP check — window:1 tolère ±30s de décalage d'horloge
        const totpDisabled = isTotpBypassActive(user.totpDisabled, user.totpDisabledUntil);
        if (user.totpEnabled && !totpDisabled) {
          if (!credentials.totpCode) return null;
          const { verify } = await import("otplib");
          let secret: string;
          try { secret = decryptSecret(user.totpSecret); } catch { return null; }
          const result = await verify({ token: credentials.totpCode, secret, epochTolerance: 30 });
          if (!result.valid) return null;
        }

        await writeAuditLog({ action: "LOGIN", actorUserId: user.id, actorUsername: user.username, actorEmail: user.email, ipAddress: ip });
        return {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
          totpEnabled: user.totpEnabled,
          totpForced: user.totpForced,
          totpDisabled,
          mustChangePassword: user.mustChangePassword,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Lors de la connexion initiale : stocker les infos dans le token
      if (user) {
        token.id = user.id;
        token.name = user.name; // username explicitement stocké
        token.role = user.role;
        token.totpEnabled = user.totpEnabled;
        token.totpForced = user.totpForced;
        token.totpDisabled = user.totpDisabled;
        token.mustChangePassword = user.mustChangePassword;
        token.sessionVersion = user.sessionVersion;
      } else if (token.id) {
        // À chaque renouvellement du token : vérifier que le user existe encore en DB
        // et rafraîchir ses données (rôle, etc.)
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, username: true, role: true, totpEnabled: true, totpForced: true, totpDisabled: true, totpDisabledUntil: true, mustChangePassword: true, sessionVersion: true },
          });
          if (!dbUser) {
            // User supprimé — invalider le token
            return {};
          }
          if (token.sessionVersion !== dbUser.sessionVersion) return {};
          // Rafraîchir depuis la DB
          token.name = dbUser.username;
          token.role = dbUser.role;
          token.totpEnabled = dbUser.totpEnabled;
          token.totpForced = dbUser.totpForced;
          token.totpDisabled = isTotpBypassActive(dbUser.totpDisabled, dbUser.totpDisabledUntil);
          token.mustChangePassword = dbUser.mustChangePassword;
          token.sessionVersion = dbUser.sessionVersion;
        } catch {
          return {};
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Si le token est vide (user supprimé), retourner une session vide
      if (!token.id) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role!;
        session.user.totpEnabled = Boolean(token.totpEnabled);
        session.user.totpForced = Boolean(token.totpForced);
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.sessionVersion = Number(token.sessionVersion ?? 0);
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : undefined;
      if (!token?.id) return;
      await writeAuditLog({
        action: "LOGOUT",
        actorUserId: String(token.id),
        actorUsername: String(token.name ?? ""),
        actorEmail: String(token.email ?? ""),
      });
    },
  },
};
