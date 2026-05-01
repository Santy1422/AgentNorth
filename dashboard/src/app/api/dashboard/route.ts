import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSession() {
  const { auth } = await import("@/lib/auth");
  const { resolveSession } = await import("@/lib/resolve-session");
  const rawSession = await auth();
  const resolved = await resolveSession(rawSession);
  return { raw: rawSession, resolved };
}

async function db() {
  const { connectDB } = await import("@/lib/db");
  return connectDB();
}

async function models() {
  return import("@/models");
}

interface ProjectLean {
  _id: string;
  name: string;
  github_url?: string;
  last_synced_at?: Date;
}

export async function POST(req: NextRequest) {
  try {
    const { resolved } = await getSession();
    if (!resolved) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = resolved;
    await db();
    const { Project, Decision } = await models();
    const body = await req.json();

    const project = await Project.findOne({ org_id: orgId, name: body.project });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const decision = await Decision.findOneAndUpdate(
      { org_id: orgId, project_id: project._id, title: body.title },
      {
        org_id: orgId,
        project_id: project._id,
        module: body.module || "",
        title: body.title,
        context: body.context || "",
        decision: body.decision || "",
        author_name: "dashboard",
        status: body.status || "active",
        source: "dashboard",
        created_at: new Date(),
      },
      { upsert: true, new: true },
    );

    // Notify SSE
    try {
      const notify = (globalThis as Record<string, unknown>).__anStreamNotify as
        ((id: string, evt: { type: string; data: unknown }) => void) | undefined;
      if (notify) {
        notify(project._id.toString(), {
          type: "decision",
          data: { title: body.title, module: body.module, at: new Date().toISOString() },
        });
      }
    } catch {}

    return NextResponse.json({ ok: true, decision_id: decision._id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { raw, resolved } = await getSession();

    if (!resolved) {
      return NextResponse.json({
        authenticated: !!raw?.user,
        data: null,
      });
    }

    const { orgId } = resolved;

    await db();
    const { Project, Decision, AgentChange, Session, UsageEvent } = await models();

    const allProjects = await Project.find({ org_id: orgId })
      .sort({ last_synced_at: -1 })
      .select("_id name github_url last_synced_at")
      .lean<ProjectLean[]>();

    const projectId = req.nextUrl.searchParams.get("project");
    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, org_id: orgId });
    }
    if (!project) {
      project = await Project.findOne({ org_id: orgId }).sort({ last_synced_at: -1 });
    }

    if (!project) {
      return NextResponse.json({
        authenticated: true,
        projects: allProjects.map((p) => ({ id: p._id, name: p.name })),
        data: null,
      });
    }

    const [decisions, changes, sessions, events, stats] = await Promise.all([
      Decision.find({ project_id: project._id }).sort({ created_at: -1 }).limit(20).lean(),
      AgentChange.find({ project_id: project._id }).sort({ created_at: -1 }).limit(20).lean(),
      Session.find({ project_id: project._id })
        .sort({ started_at: -1 })
        .limit(10)
        .populate("dev_id", "name email")
        .lean(),
      UsageEvent.find({ project_id: project._id })
        .sort({ timestamp: -1 })
        .limit(30)
        .populate("dev_id", "name")
        .lean(),
      UsageEvent.aggregate([
        { $match: { project_id: project._id } },
        {
          $group: {
            _id: null,
            total_events: { $sum: 1 },
            tokens_saved: { $sum: "$tokens_saved_estimate" },
          },
        },
      ]),
    ]);

    return NextResponse.json({
      authenticated: true,
      projects: allProjects.map((p) => ({ id: p._id, name: p.name })),
      data: {
        project: {
          id: project._id,
          name: project.name,
          modules: project.modules || [],
          deps: project.deps || [],
          audit: project.audit || [],
        },
        decisions,
        changes,
        sessions,
        events,
        tokens_saved: stats[0]?.tokens_saved || 0,
        total_events: stats[0]?.total_events || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[dashboard API]", message);
    return NextResponse.json({ authenticated: false, data: null, error: message }, { status: 500 });
  }
}
