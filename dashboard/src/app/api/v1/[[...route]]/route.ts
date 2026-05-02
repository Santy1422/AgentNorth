import { Hono } from "hono";
import { handle } from "hono/vercel";
import type { Context, Next } from "hono";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { notifyProject } from "@/lib/sse-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Zod validation schemas ──

const sessionStartSchema = z.object({
  repo: z.string().max(500).optional(),
  branch: z.string().max(200).optional(),
  model: z.string().max(100).optional(),
  conversation_id: z.string().max(200).optional(),
}).passthrough();

const sessionEndSchema = z.object({
  files_changed: z.number().optional(),
  files_touched: z.array(z.string()).max(100).optional(),
  tokens_saved: z.number().optional(),
  commit_shas: z.array(z.string()).max(50).optional(),
  changes_logged: z.number().optional(),
  decisions_logged: z.number().optional(),
  errors_count: z.number().optional(),
  tokens_input: z.number().optional(),
  tokens_output: z.number().optional(),
  edits_count: z.number().optional(),
  bash_commands_count: z.number().optional(),
}).passthrough();

const eventsSchema = z.object({
  action: z.string().max(200),
  module: z.string().max(200).optional(),
  tokens_saved_estimate: z.number().max(10000000).optional(),
  timestamp: z.string().optional(),
  file: z.string().max(500).optional(),
  tokens_input: z.number().optional(),
  tokens_output: z.number().optional(),
  files_count: z.number().optional(),
  decisions_count: z.number().optional(),
  warnings_count: z.number().optional(),
}).passthrough();

const syncSchema = z.object({
  project: z.string().max(200),
  modules: z.array(z.unknown()).optional(),
  decisions: z.array(z.unknown()).optional(),
  deps: z.array(z.unknown()).optional(),
  changes: z.array(z.unknown()).optional(),
  github_url: z.string().optional(),
  audit: z.array(z.unknown()).optional(),
}).passthrough();

/** Trim all string values in an object (shallow, top-level only) */
function trimStrings<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "string") {
      (result as Record<string, unknown>)[key] = (result[key] as string).trim();
    }
  }
  return result;
}

/** Extract client IP from request headers */
function getClientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

interface AuthEnv {
  Variables: {
    org: { _id: string; name: string };
    dev: { _id: string; name: string };
  };
}

const app = new Hono<AuthEnv>().basePath("/api/v1");

app.onError((err, c) => {
  console.error("[api/v1]", err.message);
  return c.json({ error: err.message }, 500);
});

async function db() {
  const { connectDB } = await import("@/lib/db");
  return connectDB();
}

async function models() {
  return import("@/models");
}

const authMiddleware = async (c: Context<AuthEnv>, next: Next) => {
  const ip = getClientIp(c);

  // Rate limit: 30 requests per minute per IP for authenticated endpoints
  const rl = rateLimit(`auth:${ip}`, 30, 60000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests. Try again later." }, 429);
  }

  const orgKey = c.req.header("X-Org-Key");
  const devKey = c.req.header("X-Dev-Key");

  if (!orgKey || !devKey) {
    return c.json({ error: "Missing X-Org-Key or X-Dev-Key" }, 401);
  }

  try {
    const { compare } = await import("bcryptjs");
    const { MongoClient } = await import("mongodb");

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      return c.json({ error: "Server misconfigured" }, 500);
    }

    const client = new MongoClient(uri);
    await client.connect();
    const mdb = client.db();

    const getPrefix = (key: string) => {
      const parts = key.split("_");
      return parts.length >= 3 ? `${parts[0]}_${parts[1]}_${parts[2].slice(0, 8)}` : key.slice(0, 20);
    };

    const org = await mdb.collection("organizations").findOne({ org_key_prefix: getPrefix(orgKey) });
    if (!org || !(await compare(orgKey, org.org_key_hash as string))) {
      await client.close();
      // Rate limit failed auth: 10 per minute per IP
      const failRl = rateLimit(`auth-fail:${ip}`, 10, 60000);
      if (!failRl.ok) {
        return c.json({ error: "Too many failed attempts. Try again later." }, 429);
      }
      return c.json({ error: "Invalid API keys" }, 401);
    }

    const dev = await mdb.collection("developers").findOne({ dev_key_prefix: getPrefix(devKey), org_id: org._id });
    if (!dev || !(await compare(devKey, dev.dev_key_hash as string))) {
      await client.close();
      // Rate limit failed auth: 10 per minute per IP
      const failRl = rateLimit(`auth-fail:${ip}`, 10, 60000);
      if (!failRl.ok) {
        return c.json({ error: "Too many failed attempts. Try again later." }, 429);
      }
      return c.json({ error: "Invalid API keys" }, 401);
    }

    await client.close();

    c.set("org", { _id: org._id.toString(), name: org.name as string });
    c.set("dev", { _id: dev._id.toString(), name: dev.name as string });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth failed";
    console.error("[api/v1] Auth error:", message);
    return c.json({ error: "Authentication failed" }, 500);
  }

  await next();
};

app.get("/health", (c) => c.json({ status: "ok", service: "agentnorth" }));

app.post("/sessions/start", authMiddleware, async (c) => {
  await db();
  const { Project, Session } = await models();
  const raw = await c.req.json();
  const parsed = sessionStartSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }
  const body = trimStrings(parsed.data);
  const org = c.get("org");
  const dev = c.get("dev");

  // Auto-close stale sessions for this dev
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await Session.updateMany(
      { org_id: org._id, dev_id: dev._id, ended_at: null, started_at: { $lt: twoHoursAgo } },
      { $set: { ended_at: new Date() } },
    );
  } catch (err) {
    console.error("[api/v1] session cleanup error:", err instanceof Error ? err.message : err);
  }

  // Find project by name first, then by github_url, then by most recent
  let project = await Project.findOne({ org_id: org._id, name: body.repo });
  if (!project) {
    project = await Project.findOne({ org_id: org._id, github_url: body.repo });
  }
  if (!project) {
    project = await Project.findOne({ org_id: org._id }).sort({ last_synced_at: -1 });
  }
  if (!project) {
    project = await Project.create({
      org_id: org._id,
      name: body.repo?.split("/").pop() || "unknown",
      github_url: body.repo || "",
    });
  }

  // Reuse existing active session instead of creating duplicates
  let session = await Session.findOne({
    org_id: org._id,
    dev_id: dev._id,
    project_id: project._id,
    ended_at: null,
  });
  if (!session) {
    session = await Session.create({
      org_id: org._id,
      dev_id: dev._id,
      project_id: project._id,
      branch: body.branch || "",
      repo_url: body.repo || "",
      claude_model: body.model || "",
      conversation_id: body.conversation_id || "",
    });
  } else {
    // Update existing session with any new metadata
    const updates: Record<string, unknown> = {};
    if (body.branch && !session.branch) updates.branch = body.branch;
    if (body.repo && !session.repo_url) updates.repo_url = body.repo;
    if (body.model && !session.claude_model) updates.claude_model = body.model;
    if (body.conversation_id && !session.conversation_id) updates.conversation_id = body.conversation_id;
    if (Object.keys(updates).length > 0) {
      Object.assign(session, updates);
      await session.save();
    }
  }

  // Notify SSE — session started
  notifyProject(project._id.toString(), {
    type: "session",
    data: { action: "start", dev: dev.name, branch: body.branch || "", at: new Date().toISOString() },
  });

  return c.json({ session_id: session._id });
});

app.post("/sessions/end", authMiddleware, async (c) => {
  await db();
  const { Session } = await models();
  const raw = await c.req.json();
  const parsed = sessionEndSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }
  const body = trimStrings(parsed.data);
  const org = c.get("org");
  const dev = c.get("dev");

  const session = await Session.findOne({
    org_id: org._id,
    dev_id: dev._id,
    ended_at: null,
  }).sort({ started_at: -1 });

  if (session) {
    session.ended_at = new Date();
    session.duration_mins = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
    session.files_changed_count = body.files_changed || 0;
    session.changes_logged = body.changes_logged || 0;
    session.decisions_logged = body.decisions_logged || 0;
    session.errors_count = body.errors_count || 0;
    session.edits_count = body.edits_count || 0;
    session.bash_commands_count = body.bash_commands_count || 0;
    if (Array.isArray(body.files_touched)) {
      // Merge with any files already accumulated via events
      const merged = new Set([...(session.files_touched || []), ...body.files_touched]);
      session.files_touched = [...merged];
    }
    if (Array.isArray(body.commit_shas)) {
      session.commit_shas = body.commit_shas;
    }
    if (body.tokens_saved) {
      session.tokens_saved_total = (session.tokens_saved_total || 0) + body.tokens_saved;
    }
    if (body.tokens_input) {
      session.tokens_input = (session.tokens_input || 0) + body.tokens_input;
    }
    if (body.tokens_output) {
      session.tokens_output = (session.tokens_output || 0) + body.tokens_output;
    }
    await session.save();

    // Notify SSE — session ended
    if (session.project_id) {
      notifyProject(session.project_id.toString(), {
        type: "session",
        data: {
          action: "end",
          dev: dev.name,
          branch: session.branch,
          files_changed: session.files_changed_count,
          tokens_saved: session.tokens_saved_total,
          duration_mins: session.duration_mins,
          modules_visited: session.modules_visited,
          tools_used: session.tools_used,
          events_count: session.events_count,
          at: new Date().toISOString(),
        },
      });
    }
  }

  return c.json({ ok: true });
});

app.post("/events", authMiddleware, async (c) => {
  await db();
  const { Project, Session, UsageEvent } = await models();
  const raw = await c.req.json();
  const parsed = eventsSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }
  const body = trimStrings(parsed.data);
  const org = c.get("org");
  const dev = c.get("dev");

  const project = await Project.findOne({ org_id: org._id }).sort({ last_synced_at: -1 });

  await UsageEvent.create({
    org_id: org._id,
    dev_id: dev._id,
    project_id: project?._id,
    action: body.action,
    module: body.module || "",
    tokens_saved_estimate: body.tokens_saved_estimate || 0,
    timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
  });

  // Update active session with event data
  try {
    const incFields: Record<string, number> = {
      events_count: 1,
      tokens_saved_total: body.tokens_saved_estimate || 0,
    };
    if (body.tokens_input) incFields.tokens_input = body.tokens_input;
    if (body.tokens_output) incFields.tokens_output = body.tokens_output;
    // Track decision/change logging in session counters
    if (body.action === "log_decision") incFields.decisions_logged = 1;
    if (body.action === "log_change") incFields.changes_logged = 1;
    if (body.action === "error") incFields.errors_count = 1;

    const addToSetFields: Record<string, unknown> = {
      tools_used: body.action,
    };
    if (body.module) {
      addToSetFields.modules_visited = body.module;
    }
    if (body.file) {
      addToSetFields.files_touched = body.file;
    }

    await Session.findOneAndUpdate(
      { org_id: org._id, dev_id: dev._id, ended_at: null },
      { $inc: incFields, $addToSet: addToSetFields },
      { sort: { started_at: -1 } },
    );
  } catch (err) {
    console.error("[api/v1] session update error:", err instanceof Error ? err.message : err);
  }

  // Notify SSE
  if (project?._id) {
    notifyProject(project._id.toString(), {
      type: "event",
      data: {
        action: body.action,
        module: body.module,
        tokens_saved: body.tokens_saved_estimate || 0,
        dev: dev.name,
        at: new Date().toISOString(),
      },
    });
  }

  return c.json({ ok: true });
});

app.get("/orgs/:orgId/projects", async (c) => {
  await db();
  const { Project } = await models();
  const projects = await Project.find({ org_id: c.req.param("orgId") });
  return c.json({ projects });
});

app.get("/orgs/:orgId/projects/:projectId", async (c) => {
  await db();
  const { Project } = await models();
  const project = await Project.findById(c.req.param("projectId"));
  return c.json({ project });
});

app.get("/orgs/:orgId/projects/:projectId/decisions", async (c) => {
  await db();
  const { Decision } = await models();
  const decisions = await Decision.find({
    project_id: c.req.param("projectId"),
  }).sort({ created_at: -1 }).limit(50);
  return c.json({ decisions });
});

app.get("/orgs/:orgId/projects/:projectId/changes", async (c) => {
  await db();
  const { AgentChange } = await models();
  const changes = await AgentChange.find({
    project_id: c.req.param("projectId"),
  }).sort({ created_at: -1 }).limit(50);
  return c.json({ changes });
});

app.get("/orgs/:orgId/projects/:projectId/sessions", async (c) => {
  await db();
  const { Session } = await models();
  const sessions = await Session.find({
    project_id: c.req.param("projectId"),
  })
    .sort({ started_at: -1 })
    .limit(20)
    .populate("dev_id", "name email");
  return c.json({ sessions });
});

app.get("/orgs/:orgId/projects/:projectId/events", async (c) => {
  await db();
  const { UsageEvent } = await models();
  const events = await UsageEvent.find({
    project_id: c.req.param("projectId"),
  })
    .sort({ timestamp: -1 })
    .limit(100)
    .populate("dev_id", "name");
  return c.json({ events });
});

app.get("/orgs/:orgId/stats", async (c) => {
  await db();
  const { Project, Decision, AgentChange, Session, UsageEvent } = await models();
  const orgId = c.req.param("orgId");

  const [projects, decisions, changes, sessions, events] = await Promise.all([
    Project.countDocuments({ org_id: orgId }),
    Decision.countDocuments({ org_id: orgId }),
    AgentChange.countDocuments({ org_id: orgId }),
    Session.countDocuments({ org_id: orgId }),
    UsageEvent.aggregate([
      { $match: { org_id: orgId } },
      { $group: { _id: null, total_events: { $sum: 1 }, tokens_saved: { $sum: "$tokens_saved_estimate" } } },
    ]),
  ]);

  return c.json({
    projects,
    decisions,
    changes,
    sessions,
    total_events: events[0]?.total_events || 0,
    tokens_saved: events[0]?.tokens_saved || 0,
  });
});

app.post("/sync", authMiddleware, async (c) => {
  await db();
  const { Project, Decision, AgentChange, Session } = await models();
  const raw = await c.req.json();
  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }
  const body = trimStrings(parsed.data);
  const org = c.get("org");
  const dev = c.get("dev");

  let project = await Project.findOne({ org_id: org._id, name: body.project });
  if (!project) {
    project = await Project.create({
      org_id: org._id,
      name: body.project,
      github_url: body.github_url || "",
    });
  }

  if (body.modules || body.deps || body.audit) {
    if (body.modules) project.modules = body.modules as any;
    if (body.deps) project.deps = body.deps as any;
    if (body.audit) project.audit = body.audit as any;
    project.last_synced_at = new Date();
    await project.save();
  }

  if (body.decisions) {
    for (const d of body.decisions as any[]) {
      await Decision.findOneAndUpdate(
        { org_id: org._id, project_id: project._id, title: d.title },
        {
          org_id: org._id,
          project_id: project._id,
          module: d.module,
          title: d.title,
          context: d.context || "",
          decision: d.decision,
          author_name: d.author || "unknown",
          status: d.status || "active",
          created_at: d.date ? new Date(d.date) : new Date(),
        },
        { upsert: true, new: true },
      );
    }
  }

  if (body.changes) {
    for (const ch of body.changes as any[]) {
      await AgentChange.create({
        org_id: org._id,
        project_id: project._id,
        module: ch.module,
        summary: ch.summary,
        files_changed: ch.files_changed || [],
        breaking: ch.breaking || false,
        notes: ch.notes || "",
        author_dev_id: dev._id,
        author_name: ch.author || "agent",
        created_at: ch.date ? new Date(ch.date) : new Date(),
      });
    }
  }

  // Auto-close stale sessions (older than 2 hours with no activity)
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await Session.updateMany(
      {
        org_id: org._id,
        project_id: project._id,
        ended_at: null,
        started_at: { $lt: twoHoursAgo },
      },
      { $set: { ended_at: new Date() } },
    );
  } catch (err) {
    console.error("[api/v1] stale session cleanup error:", err instanceof Error ? err.message : err);
  }

  // Auto-create/refresh agent session on sync
  try {
    const activeSession = await Session.findOne({
      org_id: org._id,
      dev_id: dev._id,
      project_id: project._id,
      ended_at: null,
    });
    if (!activeSession) {
      await Session.create({
        org_id: org._id,
        dev_id: dev._id,
        project_id: project._id,
      });
    }
  } catch (err) {
    console.error("[api/v1] session refresh error:", err instanceof Error ? err.message : err);
  }

  // ── Health snapshot (one per day per project) ──
  try {
    const { HealthSnapshot } = await models();
    const mods: any[] = body.modules || project.modules || [];
    const audit: any[] = body.audit || project.audit || [];

    // Calculate health checks
    const checks: { name: string; status: "pass" | "warn" | "fail"; detail: string }[] = [];
    const modulesCount = mods.length;
    const filesCount = mods.reduce((sum: number, m: Record<string, unknown>) => sum + ((m.files as string[])?.length || 0), 0);
    const loc = mods.reduce((sum: number, m: Record<string, unknown>) => sum + ((m.loc as number) || 0), 0);
    const deadFiles = mods.reduce((sum: number, m: Record<string, unknown>) => sum + ((m.dead_files as number) || 0), 0);
    const vulnCount = audit.length;

    // Check: modules indexed
    if (modulesCount >= 3) checks.push({ name: "Modules indexed", status: "pass", detail: `${modulesCount} modules` });
    else if (modulesCount >= 1) checks.push({ name: "Modules indexed", status: "warn", detail: `Only ${modulesCount} module(s)` });
    else checks.push({ name: "Modules indexed", status: "fail", detail: "No modules indexed" });

    // Check: dead files
    if (deadFiles === 0) checks.push({ name: "Dead files", status: "pass", detail: "No dead files" });
    else if (deadFiles <= 5) checks.push({ name: "Dead files", status: "warn", detail: `${deadFiles} dead file(s)` });
    else checks.push({ name: "Dead files", status: "fail", detail: `${deadFiles} dead files` });

    // Check: vulnerabilities
    if (vulnCount === 0) checks.push({ name: "Vulnerabilities", status: "pass", detail: "No vulnerabilities" });
    else if (vulnCount <= 3) checks.push({ name: "Vulnerabilities", status: "warn", detail: `${vulnCount} vulnerability(ies)` });
    else checks.push({ name: "Vulnerabilities", status: "fail", detail: `${vulnCount} vulnerabilities` });

    // Check: average complexity
    const allFiles = mods.flatMap((m: Record<string, unknown>) => (m.files as Record<string, unknown>[]) || []);
    const complexities = allFiles.map((f: Record<string, unknown>) => (f.complexity as number) || 0);
    const avgComplexity = complexities.length > 0
      ? complexities.reduce((s: number, v: number) => s + v, 0) / complexities.length
      : 0;
    if (avgComplexity < 8) checks.push({ name: "Average complexity", status: "pass", detail: `Avg complexity ${avgComplexity.toFixed(1)}` });
    else if (avgComplexity < 15) checks.push({ name: "Average complexity", status: "warn", detail: `Avg complexity ${avgComplexity.toFixed(1)}` });
    else checks.push({ name: "Average complexity", status: "fail", detail: `Avg complexity ${avgComplexity.toFixed(1)}` });

    // Check: documentation coverage
    const filesWithJsdoc = allFiles.filter((f: Record<string, unknown>) => Array.isArray(f.jsdoc) && (f.jsdoc as string[]).length > 0).length;
    const docCoverage = allFiles.length > 0 ? (filesWithJsdoc / allFiles.length) * 100 : 0;
    if (docCoverage >= 60) checks.push({ name: "Documentation coverage", status: "pass", detail: `${docCoverage.toFixed(0)}% of files documented` });
    else if (docCoverage >= 30) checks.push({ name: "Documentation coverage", status: "warn", detail: `${docCoverage.toFixed(0)}% of files documented` });
    else checks.push({ name: "Documentation coverage", status: "fail", detail: `${docCoverage.toFixed(0)}% of files documented` });

    // Check: large files
    const largeFiles = allFiles.filter((f: Record<string, unknown>) => ((f.loc as number) || 0) > 500).length;
    if (largeFiles === 0) checks.push({ name: "Large files", status: "pass", detail: "No files over 500 LOC" });
    else if (largeFiles <= 3) checks.push({ name: "Large files", status: "warn", detail: `${largeFiles} file(s) over 500 LOC` });
    else checks.push({ name: "Large files", status: "fail", detail: `${largeFiles} files over 500 LOC` });

    // Check: test coverage
    const modsWithTests = mods.filter((m: Record<string, unknown>) =>
      ((m.files as Record<string, unknown>[]) || []).some((f: Record<string, unknown>) => f.kind === "test")
    ).length;
    const testCoverage = modulesCount > 0 ? (modsWithTests / modulesCount) * 100 : 0;
    if (testCoverage >= 100) checks.push({ name: "Test coverage", status: "pass", detail: `All ${modulesCount} module(s) have tests` });
    else if (testCoverage >= 50) checks.push({ name: "Test coverage", status: "warn", detail: `${modsWithTests}/${modulesCount} modules have tests` });
    else checks.push({ name: "Test coverage", status: "fail", detail: `${modsWithTests}/${modulesCount} modules have tests` });

    // Score: each check pass=100, warn=50, fail=0 → average
    const scoreMap = { pass: 100, warn: 50, fail: 0 };
    const score = checks.length > 0
      ? Math.round(checks.reduce((s, ch) => s + scoreMap[ch.status], 0) / checks.length)
      : 0;

    // Only create if no snapshot exists today for this project
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existing = await HealthSnapshot.findOne({
      project_id: project._id,
      created_at: { $gte: startOfDay },
    });

    if (!existing) {
      await HealthSnapshot.create({
        org_id: org._id,
        project_id: project._id,
        score,
        checks,
        modules_count: modulesCount,
        files_count: filesCount,
        loc,
        dead_files: deadFiles,
        vuln_count: vulnCount,
      });
    }
  } catch (err) {
    console.error("[api/v1] health snapshot error:", err instanceof Error ? err.message : err);
  }

  // Notify SSE listeners of the update
  notifyProject(project._id.toString(), {
    type: "sync",
    data: { modules: (body.modules || []).length, decisions: (body.decisions || []).length, at: new Date().toISOString() },
  });

  return c.json({ ok: true, project_id: project._id });
});

// ── Pull endpoint: CLI pulls decisions/changes from dashboard ──
app.get("/pull", authMiddleware, async (c) => {
  await db();
  const { Project, Decision, AgentChange } = await models();
  const org = c.get("org");

  const projectName = c.req.query("project");
  const since = c.req.query("since"); // ISO date string

  const project = projectName
    ? await Project.findOne({ org_id: org._id, name: projectName })
    : await Project.findOne({ org_id: org._id }).sort({ last_synced_at: -1 });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const query: Record<string, unknown> = { project_id: project._id };
  if (since) {
    query.created_at = { $gt: new Date(since) };
  }

  const [decisions, changes] = await Promise.all([
    Decision.find(query).sort({ created_at: -1 }).limit(50).lean(),
    AgentChange.find(query).sort({ created_at: -1 }).limit(50).lean(),
  ]);

  return c.json({
    ok: true,
    project_id: project._id.toString(),
    project_name: project.name,
    last_synced_at: project.last_synced_at,
    decisions: decisions.map((d: Record<string, unknown>) => ({
      module: d.module,
      title: d.title,
      context: d.context,
      decision: d.decision,
      author: d.author_name,
      status: d.status,
      date: d.created_at,
      source: d.source || "local",
    })),
    changes: changes.map((ch: Record<string, unknown>) => ({
      module: ch.module,
      summary: ch.summary,
      files_changed: ch.files_changed,
      breaking: ch.breaking,
      notes: ch.notes,
      author: ch.author_name,
      date: ch.created_at,
      source: ch.source || "local",
    })),
  });
});

// ── Create decision from dashboard ──
app.post("/decisions", authMiddleware, async (c) => {
  await db();
  const { Project, Decision } = await models();
  const body = await c.req.json();
  const org = c.get("org");
  const dev = c.get("dev");

  const project = await Project.findOne({ org_id: org._id, name: body.project });
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const decision = await Decision.findOneAndUpdate(
    { org_id: org._id, project_id: project._id, title: body.title },
    {
      org_id: org._id,
      project_id: project._id,
      module: body.module || "",
      title: body.title,
      context: body.context || "",
      decision: body.decision || "",
      author_name: dev.name || "dashboard",
      status: body.status || "active",
      source: "dashboard",
      created_at: new Date(),
    },
    { upsert: true, new: true },
  );

  // Notify SSE
  notifyProject(project._id.toString(), {
    type: "decision",
    data: { title: body.title, module: body.module, at: new Date().toISOString() },
  });

  return c.json({ ok: true, decision_id: decision._id });
});

// ── Admin: delete duplicate/orphan projects ──
app.delete("/projects/:projectId", authMiddleware, async (c) => {
  await db();
  const { Project, Decision, AgentChange, Session, UsageEvent } = await models();
  const org = c.get("org");
  const projectId = c.req.param("projectId");

  const project = await Project.findOne({ _id: projectId, org_id: org._id });
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Delete all related data
  await Promise.all([
    Decision.deleteMany({ project_id: projectId }),
    AgentChange.deleteMany({ project_id: projectId }),
    Session.deleteMany({ project_id: projectId }),
    UsageEvent.deleteMany({ project_id: projectId }),
    Project.deleteOne({ _id: projectId }),
  ]);

  return c.json({ ok: true, deleted: project.name });
});

export const GET = handle(app);
export const POST = handle(app);
export const DELETE = handle(app);
