import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth() {
  const { auth } = await import("@/lib/auth");
  return auth();
}

async function db() {
  const { connectDB } = await import("@/lib/db");
  return connectDB();
}

async function models() {
  return import("@/models");
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    const orgId = (session as any)?.orgId;

    if (!orgId) {
      return NextResponse.json({ authenticated: false, data: null });
    }

    await db();
    const { Project, Decision, AgentChange, Session, UsageEvent } = await models();

    // Get all projects for this org (for the switcher)
    const allProjects = await Project.find({ org_id: orgId })
      .sort({ last_synced_at: -1 })
      .select("_id name github_url last_synced_at")
      .lean();

    // Which project to show? Check query param, fallback to most recent
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
        projects: allProjects.map((p: any) => ({ id: p._id, name: p.name })),
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
      projects: allProjects.map((p: any) => ({ id: p._id, name: p.name })),
      data: {
        project: {
          id: project._id,
          name: project.name,
          modules: project.modules || [],
        },
        decisions,
        changes,
        sessions,
        events,
        tokens_saved: stats[0]?.tokens_saved || 0,
        total_events: stats[0]?.total_events || 0,
      },
    });
  } catch (e: any) {
    console.error("[dashboard API]", e.message);
    return NextResponse.json({ authenticated: false, data: null, error: e.message }, { status: 500 });
  }
}
