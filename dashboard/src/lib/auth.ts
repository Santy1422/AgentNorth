import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { connectDB } from "./db";
import { Developer, Organization } from "../models";
import { createOrgKey, createDevKey } from "./auth-keys";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      await connectDB();
      const githubId = String(profile?.id || account?.providerAccountId);

      // Check if developer already exists
      const existing = await Developer.findOne({ github_id: githubId });
      if (existing) return true;

      // New user — check if they have an invite code (passed via state)
      // The invite code is stored in the callbackUrl as ?invite=CODE
      // We'll check it in the redirect callback instead
      // For now, create a new org by default
      const { org } = await createOrgKey(user.name ? `${user.name}'s Team` : "My Team");
      await createDevKey(
        org._id.toString(),
        user.name || "Unknown",
        user.email || "",
        githubId,
      );

      return true;
    },

    async session({ session }) {
      await connectDB();

      if (session.user?.email) {
        const dev = await Developer.findOne({ email: session.user.email }).populate("org_id");
        if (dev) {
          (session as any).orgId = dev.org_id._id.toString();
          (session as any).devId = dev._id.toString();
          (session as any).role = dev.role;
          (session as any).orgName = (dev.org_id as any).name;
        }
      }

      return session;
    },
  },
});
