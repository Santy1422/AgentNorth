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

      // Check if developer exists by github_id
      const existing = await Developer.findOne({ github_id: String(profile?.id || account?.providerAccountId) });

      if (!existing) {
        // First time: create org + dev automatically
        const { org } = await createOrgKey(user.name || "My Org");
        await createDevKey(
          org._id.toString(),
          user.name || "Unknown",
          user.email || "",
          String(profile?.id || account?.providerAccountId),
        );
      }

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
        }
      }

      return session;
    },
  },
});
