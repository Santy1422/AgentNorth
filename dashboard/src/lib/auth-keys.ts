import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

const BCRYPT_ROUNDS = 12;

export function generateKey(prefix: string): string {
  const random = randomBytes(24).toString("base64url");
  return `${prefix}_${random}`;
}

export function getKeyPrefix(key: string): string {
  const parts = key.split("_");
  return parts.length >= 3
    ? `${parts[0]}_${parts[1]}_${parts[2].slice(0, 8)}`
    : key.slice(0, 20);
}

export async function createOrgKey(orgName: string) {
  const { connectDB } = await import("./db");
  const { Organization } = await import("../models");

  await connectDB();
  const key = generateKey("an_org");
  const prefix = getKeyPrefix(key);
  const hashed = await hash(key, BCRYPT_ROUNDS);
  const inviteCode = randomBytes(8).toString("base64url");

  const org = await Organization.create({
    name: orgName,
    org_key_prefix: prefix,
    org_key_hash: hashed,
    invite_code: inviteCode,
  });

  return { org, key };
}

export async function createDevKey(orgId: string, name: string, email: string, githubId: string) {
  const { connectDB } = await import("./db");
  const { Developer } = await import("../models");

  await connectDB();
  const key = generateKey("an_dev");
  const prefix = getKeyPrefix(key);
  const hashed = await hash(key, BCRYPT_ROUNDS);

  const dev = await Developer.create({
    org_id: orgId,
    name,
    email,
    github_id: githubId,
    dev_key_prefix: prefix,
    dev_key_hash: hashed,
    role: "admin",
  });

  return { dev, key };
}

export async function authenticateKeys(orgKey: string, devKey: string) {
  const { connectDB } = await import("./db");
  const { Organization, Developer } = await import("../models");

  await connectDB();

  const orgPrefix = getKeyPrefix(orgKey);
  const org = await Organization.findOne({ org_key_prefix: orgPrefix });
  if (!org) return null;

  const orgValid = await compare(orgKey, org.org_key_hash);
  if (!orgValid) return null;

  const devPrefix = getKeyPrefix(devKey);
  const dev = await Developer.findOne({ dev_key_prefix: devPrefix, org_id: org._id });
  if (!dev) return null;

  const devValid = await compare(devKey, dev.dev_key_hash);
  if (!devValid) return null;

  dev.last_active_at = new Date();
  await dev.save();

  return { org, dev };
}
