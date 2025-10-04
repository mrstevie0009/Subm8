import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      handle: string | null;
      role: Role | null;
      /** ⇨ neu */
      ageVerified?: boolean | null;
    };
  }

  interface User {
    handle: string | null;
    role: Role | null;
    /** ⇨ neu */
    ageVerified?: boolean | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    handle?: string | null;
    role?: Role | null;
    /** ⇨ neu */
    ageVerified?: boolean | null;
  }
}
