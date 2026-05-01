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
      try {
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
      } catch (err) {
        console.error("[auth] signIn callback error:", err);
        // Allow sign-in even if DB fails — session callback will handle missing data
        return true;
      }
    },

    async session({ session }) {
      try {
        const { connectDB } = await import("./db");
        const { Developer } = await import("../models");

        await connectDB();

        if (session.user?.email) {
          const dev = await Developer.findOne({ email: session.user.email }).populate("org_id");
          if (dev) {
            const org = dev.org_id as unknown as { _id: { toString(): string }; name: string };
            session.orgId = org._id.toString();
            session.devId = dev._id.toString();
            session.role = dev.role;
            session.orgName = org.name;
          }
        }
      } catch (err) {
        console.error("[auth] session callback error:", err);
      }

      return session;
    },
  },
});
