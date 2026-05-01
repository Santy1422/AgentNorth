import "next-auth";

declare module "next-auth" {
  interface Session {
    orgId?: string;
    devId?: string;
    role?: "admin" | "member";
    orgName?: string;
  }
}
