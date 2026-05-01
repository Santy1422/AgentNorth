import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const { connectDB } = await import("./db");
      const { Developer } = await import("../models");
      const { createOrgKey, createDevKey } = await import("./auth-keys");

      await connectDB();
      const githubId = String(profile?.id || account?.providerAccountId);

      const existing = await Developer.findOne({ github_id: githubId });
      if (existing) return true;

      // New user — create org + dev
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
      const { connectDB } = await import("./db");
      const { Developer } = await import("../models");

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
