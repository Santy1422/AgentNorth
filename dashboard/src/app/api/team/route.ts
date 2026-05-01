import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSession() {
  const { auth } = await import("@/lib/auth");
  const { resolveSession } = await import("@/lib/resolve-session");
  const session = await auth();
  return resolveSession(session);
}

async function db() {
  const { connectDB } = await import("@/lib/db");
  return connectDB();
}

/** GET /api/team — Get team members + invite code */
export async function GET() {
  const resolved = await getSession();
  if (!resolved) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await db();
  const { Organization, Developer } = await import("@/models");

  const org = await Organization.findById(resolved.orgId);
  const members = await Developer.find({ org_id: resolved.orgId })
    .select("name email role github_id last_active_at created_at")
    .sort({ created_at: 1 });

  return NextResponse.json({
    org: { name: org?.name, invite_code: org?.invite_code, plan: org?.plan },
    members,
  });
}
