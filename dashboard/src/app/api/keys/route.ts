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

/** GET /api/keys — Show current key prefixes (not full keys) */
export async function GET() {
  const resolved = await getSession();
  if (!resolved) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await db();
  const { Organization, Developer } = await import("@/models");
  const org = await Organization.findById(resolved.orgId);
  const dev = await Developer.findById(resolved.devId);

  return NextResponse.json({
    org_key_prefix: org?.org_key_prefix || null,
    dev_key_prefix: dev?.dev_key_prefix || null,
    hint: "Keys are only shown once when generated. Use POST /api/keys to regenerate.",
  });
}

/** POST /api/keys — Regenerate API keys for the current user */
export async function POST() {
  const resolved = await getSession();
  if (!resolved) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await db();
  const { Organization, Developer } = await import("@/models");
  const { generateKey, getKeyPrefix } = await import("@/lib/auth-keys");
  const { hash } = await import("bcryptjs");

  const org = await Organization.findById(resolved.orgId);
  const dev = await Developer.findById(resolved.devId);
  if (!org || !dev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newOrgKey = generateKey("an_org");
  const newDevKey = generateKey("an_dev");

  org.org_key_prefix = getKeyPrefix(newOrgKey);
  org.org_key_hash = await hash(newOrgKey, 12);
  await org.save();

  dev.dev_key_prefix = getKeyPrefix(newDevKey);
  dev.dev_key_hash = await hash(newDevKey, 12);
  await dev.save();

  return NextResponse.json({
    org_key: newOrgKey,
    dev_key: newDevKey,
    warning: "Save these keys now — they won't be shown again.",
  });
}
