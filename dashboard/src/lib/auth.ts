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
        return true;
      }
    },

    async jwt({ token, account, profile }) {
      // On initial sign-in, store githubId in the token
      if (account && profile) {
        token.githubId = String(profile.id || account.providerAccountId);
      }

      // Load org/dev data from DB (cached in token so we don't query every request)
      if (!token.orgId && (token.githubId || token.email)) {
        try {
          const { connectDB } = await import("./db");
          const { Developer } = await import("../models");

          await connectDB();

          // Try github_id first (most reliable), fall back to email
          let dev = token.githubId
            ? await Developer.findOne({ github_id: token.githubId }).populate("org_id")
            : null;

          if (!dev && token.email) {
            dev = await Developer.findOne({ email: token.email }).populate("org_id");
          }

          if (dev) {
            const org = dev.org_id as unknown as { _id: { toString(): string }; name: string };
            token.orgId = org._id.toString();
            token.devId = dev._id.toString();
            token.role = dev.role;
            token.orgName = org.name;
          }
        } catch (err) {
          console.error("[auth] jwt callback error:", err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.orgId = token.orgId;
      session.devId = token.devId;
      session.role = token.role;
      session.orgName = token.orgName;
      session.githubId = token.githubId;
      return session;
    },
  },
});
