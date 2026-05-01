import { Hono } from "hono";
import { handle } from "hono/vercel";
import type { Context, Next } from "hono";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function authKeys(orgKey: string, devKey: string) {
  const { authenticateKeys } = await import("@/lib/auth-keys");
  return authenticateKeys(orgKey, devKey);
}

const authMiddleware = async (c: Context<AuthEnv>, next: Next) => {
  const orgKey = c.req.header("X-Org-Key");
  const devKey = c.req.header("X-Dev-Key");

  if (!orgKey || !devKey) {
    return c.json({ error: "Missing X-Org-Key or X-Dev-Key" }, 401);
  }

  try {
    await db();
    const auth = await authKeys(orgKey, devKey);
    if (!auth) {
      return c.json({ error: "Invalid API keys" }, 401);
    }

    c.set("org", auth.org);
    c.set("dev", auth.dev);
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
  const body = await c.req.json();
  const org = c.get("org");
  const dev = c.get("dev");

  let project = await Project.findOne({ org_id: org._id, github_url: body.repo });
  if (!project) {
    project = await Project.create({
      org_id: org._id,
      name: body.repo?.split("/").pop() || "unknown",
      github_url: body.repo || "",
    });
  }

  const session = await Session.create({
    org_id: org._id,
    dev_id: dev._id,
    project_id: project._id,
  });

  return c.json({ session_id: session._id });
});

app.post("/sessions/end", authMiddleware, async (c) => {
  await db();
  const { Session } = await models();
  const body = await c.req.json();
  const org = c.get("org");
  const dev = c.get("dev");

  const session = await Session.findOne({
    org_id: org._id,
    dev_id: dev._id,
    ended_at: null,
  }).sort({ started_at: -1 });

  if (session) {
    session.ended_at = new Date();
    session.actions_count = body.files_changed || 0;
    await session.save();
  }

  return c.json({ ok: true });
});

app.post("/events", authMiddleware, async (c) => {
  await db();
  const { Project, UsageEvent } = await models();
  const body = await c.req.json();
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
  const { Project, Decision, AgentChange } = await models();
  const body = await c.req.json();
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

  if (body.modules) {
    project.modules = body.modules;
    project.last_synced_at = new Date();
    await project.save();
  }

  if (body.decisions) {
    for (const d of body.decisions) {
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
    for (const ch of body.changes) {
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

  return c.json({ ok: true, project_id: project._id });
});

export const GET = handle(app);
export const POST = handle(app);
