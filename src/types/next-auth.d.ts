import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      totpEnabled: boolean;
      totpForced: boolean;
      mustChangePassword: boolean;
      sessionVersion: number;
    };
  }

  interface User extends DefaultUser {
    role: Role;
    totpEnabled: boolean;
    totpForced: boolean;
    totpDisabled: boolean;
    mustChangePassword: boolean;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: Role;
    totpEnabled?: boolean;
    totpForced?: boolean;
    totpDisabled?: boolean;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}
