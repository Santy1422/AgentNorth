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

/** POST /api/join — Join an org via invite code */
export async function POST(req: Request) {
  const resolved = await getSession();
  if (!resolved) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { invite_code } = await req.json();
  if (!invite_code) {
    return NextResponse.json({ error: "Missing invite_code" }, { status: 400 });
  }

  await db();
  const { Organization, Developer } = await import("@/models");

  const targetOrg = await Organization.findOne({ invite_code });
  if (!targetOrg) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const dev = await Developer.findById(resolved.devId);
  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  const oldOrgId = dev.org_id.toString();
  const newOrgId = targetOrg._id.toString();

  if (oldOrgId === newOrgId) {
    return NextResponse.json({ ok: true, org_name: targetOrg.name, message: "Already in this team" });
  }

  dev.org_id = targetOrg._id;
  dev.role = "member";
  await dev.save();

  const remaining = await Developer.countDocuments({ org_id: oldOrgId });
  if (remaining === 0) {
    await Organization.findByIdAndDelete(oldOrgId);
  }

  return NextResponse.json({ ok: true, org_name: targetOrg.name });
}
