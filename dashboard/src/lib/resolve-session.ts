import type { Session } from "next-auth";

interface ResolvedSession {
  orgId: string;
  devId: string;
  role: "admin" | "member";
}

/**
 * Resolves orgId/devId from a NextAuth session.
 * If the JWT doesn't have them yet (e.g. DB was down during sign-in),
 * looks up or creates the Developer record.
 */
export async function resolveSession(
  session: Session | null,
): Promise<ResolvedSession | null> {
  if (!session?.user) return null;

  // Fast path: JWT already has the data
  if (session.orgId && session.devId) {
    return {
      orgId: session.orgId,
      devId: session.devId,
      role: session.role || "member",
    };
  }

  // Slow path: look up or create Developer
  try {
    const { connectDB } = await import("./db");
    const { Developer } = await import("../models");
    const { createOrgKey, createDevKey } = await import("./auth-keys");

    await connectDB();

    let dev = session.githubId
      ? await Developer.findOne({ github_id: session.githubId })
      : null;
    if (!dev && session.user.email) {
      dev = await Developer.findOne({ email: session.user.email });
    }

    if (dev) {
      return {
        orgId: dev.org_id.toString(),
        devId: dev._id.toString(),
        role: dev.role,
      };
    }

    // Create new org + developer
    const { org } = await createOrgKey(
      session.user.name ? `${session.user.name}'s Team` : "My Team",
    );
    const { dev: newDev } = await createDevKey(
      org._id.toString(),
      session.user.name || "Unknown",
      session.user.email || "",
      session.githubId || "",
    );

    return {
      orgId: org._id.toString(),
      devId: newDev._id.toString(),
      role: newDev.role,
    };
  } catch (err) {
    console.error("[resolve-session] Error:", err);
    return null;
  }
}
