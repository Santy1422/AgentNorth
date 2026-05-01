import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    orgId?: string;
    devId?: string;
    role?: "admin" | "member";
    orgName?: string;
    githubId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    orgId?: string;
    devId?: string;
    role?: "admin" | "member";
    orgName?: string;
    githubId?: string;
  }
}
