import { describe, it, expect } from "vitest";
import { generateKey, getKeyPrefix } from "@/lib/auth-keys";
import { hash, compare } from "bcryptjs";

describe("generateKey", () => {
  it("generates an org key with an_org_ prefix", () => {
    const key = generateKey("an_org");
    expect(key).toMatch(/^an_org_[A-Za-z0-9_-]+$/);
  });

  it("generates a dev key with an_dev_ prefix", () => {
    const key = generateKey("an_dev");
    expect(key).toMatch(/^an_dev_[A-Za-z0-9_-]+$/);
  });

  it("generates unique keys each time", () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateKey("an_org")));
    expect(keys.size).toBe(20);
  });

  it("key has sufficient length (prefix + 24 bytes base64url)", () => {
    const key = generateKey("an_org");
    // "an_org_" is 7 chars, base64url of 24 bytes is 32 chars
    expect(key.length).toBeGreaterThanOrEqual(39);
  });
});

describe("getKeyPrefix", () => {
  it("extracts prefix from org key (first 3 parts, 8 char truncation)", () => {
    const key = "an_org_abcdefghij1234567890ABCDEF";
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe("an_org_abcdefgh");
  });

  it("extracts prefix from dev key", () => {
    const key = "an_dev_XYZabcde12345678";
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe("an_dev_XYZabcde");
  });

  it("falls back to first 20 chars for keys without underscores", () => {
    const key = "nounderscorekeyformat1234567890";
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe("nounderscorekeyforma");
  });

  it("works with a real generated key", () => {
    const key = generateKey("an_org");
    const prefix = getKeyPrefix(key);
    expect(prefix).toMatch(/^an_org_[A-Za-z0-9_-]{8}$/);
  });
});

describe("key hashing and comparison", () => {
  it("hashed key validates with bcrypt compare", async () => {
    const key = generateKey("an_org");
    const hashed = await hash(key, 12);
    const valid = await compare(key, hashed);
    expect(valid).toBe(true);
  });

  it("wrong key fails bcrypt compare", async () => {
    const key1 = generateKey("an_org");
    const key2 = generateKey("an_org");
    const hashed = await hash(key1, 12);
    const valid = await compare(key2, hashed);
    expect(valid).toBe(false);
  });

  it("same key hashed twice produces different hashes", async () => {
    const key = generateKey("an_dev");
    const hash1 = await hash(key, 4);
    const hash2 = await hash(key, 4);
    expect(hash1).not.toBe(hash2);
    // But both should validate
    expect(await compare(key, hash1)).toBe(true);
    expect(await compare(key, hash2)).toBe(true);
  });
});
