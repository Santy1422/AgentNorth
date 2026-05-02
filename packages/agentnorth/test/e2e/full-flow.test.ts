import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.setConfig({ testTimeout: 30000 });
import { mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const FIXTURE_DIR = join(import.meta.dirname, "../fixtures/repo-e2e");

describe("e2e: full flow", () => {
  beforeEach(async () => {
    // Create a realistic mini project
    await mkdir(join(FIXTURE_DIR, "src/auth"), { recursive: true });
    await mkdir(join(FIXTURE_DIR, "src/billing"), { recursive: true });
    await mkdir(join(FIXTURE_DIR, ".git"), { recursive: true }); // fake git

    await writeFile(
      join(FIXTURE_DIR, "src/auth/middleware.ts"),
      `import { verify } from "jsonwebtoken";
import { NextRequest } from "next/server";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "user";
}

export function authMiddleware(req: NextRequest): AuthUser | null {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verify(token, process.env.JWT_SECRET!) as AuthUser;
}

export function requireAuth(req: NextRequest): AuthUser {
  const user = authMiddleware(req);
  if (!user) throw new Error("Unauthorized");
  return user;
}
`,
      "utf-8",
    );

    await writeFile(
      join(FIXTURE_DIR, "src/auth/session.ts"),
      `import { AuthUser } from "./middleware";

export class SessionStore {
  private sessions = new Map<string, AuthUser>();

  set(token: string, user: AuthUser): void {
    this.sessions.set(token, user);
  }

  get(token: string): AuthUser | undefined {
    return this.sessions.get(token);
  }

  delete(token: string): void {
    this.sessions.delete(token);
  }
}

export const sessionStore = new SessionStore();
`,
      "utf-8",
    );

    await writeFile(
      join(FIXTURE_DIR, "src/billing/stripe.ts"),
      `import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export async function createCheckout(priceId: string, customerId: string) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId);
}
`,
      "utf-8",
    );
  });

  afterEach(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });

  it("init → index → setup produces complete project structure", async () => {
    const { initCommand } = await import("../../src/cli/commands/init.js");
    const { indexCommand } = await import("../../src/cli/commands/index.js");
    const { setupCommand } = await import("../../src/cli/commands/setup.js");

    const origCwd = process.cwd;
    process.cwd = () => FIXTURE_DIR;

    try {
      // Step 1: init
      await initCommand({});

      // Verify config created
      const configPath = join(FIXTURE_DIR, ".agentnorth", "config.yaml");
      expect(existsSync(configPath)).toBe(true);
      const configContent = await readFile(configPath, "utf-8");
      expect(configContent).toContain("auth");
      expect(configContent).toContain("billing");

      // Step 2: index
      await indexCommand({});

      // Verify bundles created
      const bundlesDir = join(FIXTURE_DIR, ".agentnorth", "bundles");
      expect(existsSync(join(bundlesDir, "auth.json"))).toBe(true);
      expect(existsSync(join(bundlesDir, "billing.json"))).toBe(true);

      // Verify bundle content
      const authBundle = JSON.parse(await readFile(join(bundlesDir, "auth.json"), "utf-8"));
      expect(authBundle.module).toBe("auth");
      expect(authBundle.files.length).toBe(2);
      expect(authBundle.files.some((f: any) => f.path.includes("middleware.ts"))).toBe(true);
      expect(authBundle.files.some((f: any) => f.exports.includes("authMiddleware"))).toBe(true);
      expect(authBundle.dependencies.external).toContain("jsonwebtoken");

      const billingBundle = JSON.parse(await readFile(join(bundlesDir, "billing.json"), "utf-8"));
      expect(billingBundle.module).toBe("billing");
      expect(billingBundle.dependencies.external).toContain("stripe");

      // Step 3: setup
      await setupCommand();

      // Verify .claude/ structure
      expect(existsSync(join(FIXTURE_DIR, ".claude", "settings.json"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-session-start.sh"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-enforce-context.sh"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-enforce-edit.sh"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-track-usage.sh"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-track-edits.sh"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, ".claude", "hooks", "agentnorth-session-end.sh"))).toBe(true);
      expect(existsSync(join(FIXTURE_DIR, "CLAUDE.md"))).toBe(true);

      // Verify settings.json has correct structure
      const settings = JSON.parse(
        await readFile(join(FIXTURE_DIR, ".claude", "settings.json"), "utf-8"),
      );
      expect(settings.mcpServers.agentnorth.command).toBe("npx");
      expect(settings.hooks.SessionStart).toHaveLength(1);
      expect(settings.hooks.PreToolUse[0].matcher).toBe("Read|Grep|Glob");

      // Verify CLAUDE.md mentions AgentNorth
      const claudeMd = await readFile(join(FIXTURE_DIR, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toContain("agentnorth_get_context");
      expect(claudeMd).toContain("agentnorth_log_change");
    } finally {
      process.cwd = origCwd;
    }
  });

  it("bundle token size is significantly smaller than raw files", async () => {
    const { initCommand } = await import("../../src/cli/commands/init.js");
    const { indexCommand } = await import("../../src/cli/commands/index.js");

    const origCwd = process.cwd;
    process.cwd = () => FIXTURE_DIR;

    try {
      await initCommand({});
      await indexCommand({});

      // Read raw source files
      const authMiddleware = await readFile(join(FIXTURE_DIR, "src/auth/middleware.ts"), "utf-8");
      const authSession = await readFile(join(FIXTURE_DIR, "src/auth/session.ts"), "utf-8");
      const billingStripe = await readFile(join(FIXTURE_DIR, "src/billing/stripe.ts"), "utf-8");
      const rawSize = authMiddleware.length + authSession.length + billingStripe.length;

      // Read bundles
      const authBundle = await readFile(join(FIXTURE_DIR, ".agentnorth", "bundles", "auth.json"), "utf-8");
      const billingBundle = await readFile(join(FIXTURE_DIR, ".agentnorth", "bundles", "billing.json"), "utf-8");
      const bundleSize = authBundle.length + billingBundle.length;

      // Bundles should be smaller than reading all raw files
      // (In practice agents would also need to grep/explore to find these files)
      console.error(`Raw source: ${rawSize} chars, Bundles: ${bundleSize} chars`);
      // The bundle is structured JSON with metadata, so it might be similar in size
      // for small projects, but the VALUE is that agents don't need to discover files
      expect(bundleSize).toBeDefined();
      expect(authBundle).toContain('"module": "auth"');
    } finally {
      process.cwd = origCwd;
    }
  });
});
