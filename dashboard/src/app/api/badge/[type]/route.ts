import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project, type IProject } from "@/models/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function measureText(text: string): number {
  // Approximate width for 11px Verdana (shields.io style)
  return text.length * 6.8 + 10;
}

function pickColor(type: string, project: IProject): string {
  switch (type) {
    case "health": {
      const score = computeHealth(project);
      if (score >= 80) return "#4c1";
      if (score >= 50) return "#dfb317";
      return "#e05d44";
    }
    case "modules":
      return "#007ec6";
    case "coverage": {
      const pct = computeCoverage(project);
      if (pct >= 80) return "#4c1";
      if (pct >= 40) return "#dfb317";
      return "#e05d44";
    }
    case "deps": {
      const vulns = project.audit?.length ?? 0;
      return vulns > 0 ? "#e05d44" : "#4c1";
    }
    default:
      return "#9f9f9f";
  }
}

function computeHealth(project: IProject): number {
  let score = 0;
  const mods = project.modules?.length ?? 0;
  const deps = project.deps?.length ?? 0;
  const vulns = project.audit?.length ?? 0;
  const coverage = computeCoverage(project);

  // Modules indexed: up to 30 pts
  score += Math.min(mods * 10, 30);
  // Dependencies tracked: up to 20 pts
  score += deps > 0 ? 20 : 0;
  // No vulnerabilities: 20 pts
  score += vulns === 0 ? 20 : Math.max(0, 20 - vulns * 5);
  // Documentation coverage: up to 30 pts
  score += Math.round((coverage / 100) * 30);

  return Math.min(Math.max(score, 0), 100);
}

function computeCoverage(project: IProject): number {
  const mods = project.modules ?? [];
  if (mods.length === 0) return 0;
  const documented = mods.filter(
    (m) => m.description && m.description.trim().length > 0,
  ).length;
  return Math.round((documented / mods.length) * 100);
}

function badgeLabel(type: string): string {
  switch (type) {
    case "health":
      return "health";
    case "modules":
      return "modules";
    case "coverage":
      return "docs";
    case "deps":
      return "deps";
    default:
      return type;
  }
}

function badgeValue(type: string, project: IProject): string {
  switch (type) {
    case "health":
      return `${computeHealth(project)}/100`;
    case "modules":
      return `${project.modules?.length ?? 0}`;
    case "coverage":
      return `${computeCoverage(project)}%`;
    case "deps": {
      const vulns = project.audit?.length ?? 0;
      const count = project.deps?.length ?? 0;
      return vulns > 0 ? `${vulns} vulns` : `${count}`;
    }
    default:
      return "?";
  }
}

function buildSvg(
  label: string,
  value: string,
  color: string,
  style: string,
): string {
  const labelW = measureText(label);
  const valueW = measureText(value);
  const totalW = labelW + valueW;
  const r = style === "flat-square" ? 0 : 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="c">
    <rect width="${totalW}" height="20" rx="${r}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#c)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelW / 2}" y="14">${label}</text>
    <text x="${labelW + valueW / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelW + valueW / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

function errorBadge(label: string, msg: string, style: string): string {
  return buildSvg(label, msg, "#9f9f9f", style);
}

const VALID_TYPES = new Set(["health", "modules", "coverage", "deps"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("project");
  const style = searchParams.get("style") === "flat-square" ? "flat-square" : "flat";

  const headers = {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "max-age=300",
  };

  if (!VALID_TYPES.has(type)) {
    return new NextResponse(errorBadge(type, "unknown", style), { headers });
  }

  if (!projectId) {
    return new NextResponse(errorBadge(badgeLabel(type), "no project", style), { headers });
  }

  try {
    await connectDB();
    const project = await Project.findById(projectId).lean<IProject>();

    if (!project) {
      return new NextResponse(errorBadge(badgeLabel(type), "not found", style), { headers });
    }

    const label = badgeLabel(type);
    const value = badgeValue(type, project);
    const color = pickColor(type, project);
    const svg = buildSvg(label, value, color, style);

    return new NextResponse(svg, { headers });
  } catch (err) {
    console.error("[badge]", err);
    return new NextResponse(errorBadge(badgeLabel(type), "error", style), { headers });
  }
}
