"use client";

import { useMemo } from "react";
import type { DashboardData, ModuleData, FileData } from "@/app/page";
import { useT } from "@/i18n/provider";

const KIND_COLORS: Record<string, string> = {
  page: "#f97316",
  component: "#a78bfa",
  hook: "#4ade80",
  lib: "#fbbf24",
  model: "#60a5fa",
  route: "#f472b6",
  schema: "#34d399",
  test: "#94a3b8",
  config: "#a1a1aa",
  unknown: "#71717a",
};

function shortName(path: string): string {
  return path.split("/").pop() || path;
}

export function OnboardingGuide({ data }: { data: DashboardData | null }) {
  const { t } = useT();
  const modules = data?.project.modules || [];
  const decisions = data?.decisions || [];
  const deps = data?.project.deps || [];
  const audit = data?.project.audit || [];

  const allFiles = useMemo(() => {
    const seen = new Set<string>();
    return modules.flatMap((m) => m.files || []).filter((f) => {
      if (seen.has(f.path)) return false;
      seen.add(f.path);
      return true;
    });
  }, [modules]);

  const stats = useMemo(() => {
    const screens = allFiles.filter((f) => f.kind === "page");
    const routes = allFiles.filter((f) => f.kind === "route");
    const components = allFiles.filter((f) => f.kind === "component");
    const hooks = allFiles.filter((f) => f.kind === "hook");
    const libs = allFiles.filter((f) => f.kind === "lib");
    const models = allFiles.filter((f) => f.kind === "model");
    const tests = allFiles.filter((f) => f.kind === "test");
    const totalLoc = modules.reduce((s, m) => s + (m.loc || 0), 0);
    return { screens, routes, components, hooks, libs, models, tests, totalLoc };
  }, [allFiles, modules]);

  // Entry points: the most important files to understand first
  const entryPoints = useMemo(() => {
    const entries: { file: FileData; reason: string; priority: number }[] = [];

    // Pages are primary entry points
    for (const f of stats.screens) {
      const depCount = f.imports.length;
      entries.push({
        file: f,
        reason: `Main screen — ${depCount} dependencies, ${f.loc} LOC`,
        priority: 100 + depCount,
      });
    }

    // Most-imported files are critical to understand
    const importCounts = allFiles.map((f) => {
      const name = shortName(f.path).replace(/\.(tsx?|jsx?)$/, "");
      const count = allFiles.filter(
        (other) =>
          other.path !== f.path &&
          other.imports?.some(
            (imp) => imp.source.endsWith(name) || imp.source.endsWith("/" + name)
          )
      ).length;
      return { file: f, count };
    });

    const topImported = importCounts
      .filter((x) => x.count >= 3 && x.file.kind !== "page")
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    for (const { file, count } of topImported) {
      entries.push({
        file,
        reason: `Used by ${count} files — critical system file`,
        priority: 50 + count,
      });
    }

    return entries.sort((a, b) => b.priority - a.priority);
  }, [allFiles, stats.screens]);

  // Module dependency matrix
  const moduleDeps = useMemo(() => {
    return modules.map((m) => {
      const internal = m.dependencies?.internal || [];
      const external = m.dependencies?.external || [];
      return { name: m.name, internal, external, files: m.files_count, loc: m.loc };
    });
  }, [modules]);

  // Tech stack from external deps
  const techStack = useMemo(() => {
    const categories: Record<string, { name: string; deps: string[] }> = {
      framework: { name: t("guide.framework"), deps: [] },
      ui: { name: t("guide.uiStyles"), deps: [] },
      state: { name: t("guide.stateData"), deps: [] },
      tooling: { name: t("guide.tooling"), deps: [] },
      testing: { name: t("guide.testing"), deps: [] },
      other: { name: t("guide.other"), deps: [] },
    };

    const frameworkPkgs = ["next", "react", "react-dom", "express", "fastify", "nuxt", "vue", "svelte", "angular"];
    const uiPkgs = ["tailwindcss", "styled-components", "@emotion", "sass", "postcss", "@radix-ui", "@headlessui", "lucide", "framer-motion"];
    const statePkgs = ["zustand", "redux", "@reduxjs", "mobx", "jotai", "recoil", "swr", "react-query", "@tanstack", "axios", "mongoose", "prisma", "@prisma"];
    const toolPkgs = ["typescript", "eslint", "prettier", "webpack", "vite", "turbo", "tsup", "esbuild"];
    const testPkgs = ["jest", "vitest", "@testing-library", "cypress", "playwright"];

    for (const d of deps) {
      const n = d.name.toLowerCase();
      if (frameworkPkgs.some((p) => n.startsWith(p))) categories.framework.deps.push(d.name);
      else if (uiPkgs.some((p) => n.startsWith(p))) categories.ui.deps.push(d.name);
      else if (statePkgs.some((p) => n.startsWith(p))) categories.state.deps.push(d.name);
      else if (toolPkgs.some((p) => n.startsWith(p))) categories.tooling.deps.push(d.name);
      else if (testPkgs.some((p) => n.startsWith(p))) categories.testing.deps.push(d.name);
      else if (d.kind === "prod") categories.other.deps.push(d.name);
    }

    return Object.values(categories).filter((c) => c.deps.length > 0);
  }, [deps]);

  // Conventions detected
  const conventions = useMemo(() => {
    const conv: { title: string; detail: string }[] = [];

    // File structure convention
    const hasAppDir = allFiles.some((f) => f.path.includes("/app/"));
    const hasPagesDir = allFiles.some((f) => f.path.includes("/pages/"));
    if (hasAppDir) conv.push({ title: "Next.js App Router", detail: "El proyecto usa el directorio app/ de Next.js 13+" });
    else if (hasPagesDir) conv.push({ title: "Next.js Pages Router", detail: "El proyecto usa pages/ de Next.js" });

    // TypeScript
    const hasTsx = allFiles.some((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts"));
    if (hasTsx) conv.push({ title: "TypeScript", detail: "El proyecto usa TypeScript para type-safety" });

    // Has tests
    if (stats.tests.length > 0) {
      conv.push({ title: "Testing", detail: `${stats.tests.length} test files detected` });
    }

    // API routes
    if (stats.routes.length > 0) {
      conv.push({ title: "API Routes", detail: `${stats.routes.length} endpoints API en app/api/` });
    }

    // Component patterns
    if (stats.hooks.length > 0) {
      conv.push({ title: "Custom Hooks", detail: `${stats.hooks.length} hooks custom para reusar logica` });
    }

    // Decisions as conventions
    for (const d of decisions.slice(0, 3)) {
      conv.push({ title: d.title, detail: d.decision || d.context || "" });
    }

    return conv;
  }, [allFiles, stats, decisions]);

  if (!data || allFiles.length === 0) {
    return (
      <section className="onb-guide">
        <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
          <h2>{t("guide.title")}</h2>
        </div>
        <div className="empty-state-lg">
          <div className="empty-icon">&#x1F4D6;</div>
          <div className="empty-title">{t("guide.noData")}</div>
          <div className="empty-desc">
            {t("guide.noDataDesc")}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="onb-guide">
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>{t("guide.title")}</h2>
        <span className="meta">{t("guide.subtitle")}</span>
      </div>

      {/* Project overview */}
      <div className="onb-hero">
        <div className="onb-hero-title">{data.project.name}</div>
        <div className="onb-hero-desc">
          {allFiles.length} files · {stats.totalLoc.toLocaleString("en")} lines ·{" "}
          {modules.length} modules · {stats.routes.length} APIs
        </div>
        <div className="onb-hero-stack">
          {techStack.map((cat) => (
            <div key={cat.name} className="onb-stack-group">
              <span className="onb-stack-label">{cat.name}</span>
              <div className="onb-stack-items">
                {cat.deps.map((d) => (
                  <span key={d} className="onb-stack-chip mono">{d}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture summary */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>{t("guide.arch30s")}</h2>
        </div>
        <div className="onb-arch-summary">
          <div className="onb-arch-layer">
            <div className="onb-arch-num" style={{ color: KIND_COLORS.page }}>{stats.screens.length}</div>
            <div className="onb-arch-label">{t("guide.screens")}</div>
            <div className="onb-arch-desc">{t("guide.screensDesc")}</div>
          </div>
          <div className="onb-arch-arrow">{"\u2192"}</div>
          <div className="onb-arch-layer">
            <div className="onb-arch-num" style={{ color: KIND_COLORS.component }}>{stats.components.length}</div>
            <div className="onb-arch-label">{t("guide.components")}</div>
            <div className="onb-arch-desc">{t("guide.componentsDesc")}</div>
          </div>
          <div className="onb-arch-arrow">{"\u2192"}</div>
          <div className="onb-arch-layer">
            <div className="onb-arch-num" style={{ color: KIND_COLORS.hook }}>{stats.hooks.length}</div>
            <div className="onb-arch-label">{t("guide.hooks")}</div>
            <div className="onb-arch-desc">{t("guide.hooksDesc")}</div>
          </div>
          <div className="onb-arch-arrow">{"\u2192"}</div>
          <div className="onb-arch-layer">
            <div className="onb-arch-num" style={{ color: KIND_COLORS.lib }}>{stats.libs.length}</div>
            <div className="onb-arch-label">{t("guide.libraries")}</div>
            <div className="onb-arch-desc">{t("guide.librariesDesc")}</div>
          </div>
          <div className="onb-arch-arrow">{"\u2192"}</div>
          <div className="onb-arch-layer">
            <div className="onb-arch-num" style={{ color: KIND_COLORS.route }}>{stats.routes.length}</div>
            <div className="onb-arch-label">{t("guide.apisLabel")}</div>
            <div className="onb-arch-desc">{t("guide.apisDesc")}</div>
          </div>
        </div>
      </div>

      {/* Where to start reading */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>{t("guide.whereToStart")}</h2>
          <span className="meta">{t("guide.keyFiles")}</span>
        </div>
        <div className="onb-entries">
          {entryPoints.map(({ file, reason }, i) => (
            <div key={file.path} className="onb-entry">
              <div className="onb-entry-rank">{i + 1}</div>
              <div className="onb-entry-info">
                <div className="onb-entry-head">
                  <span className="cov-file-kind" style={{ background: KIND_COLORS[file.kind] || KIND_COLORS.unknown }}>
                    {file.kind}
                  </span>
                  <span className="onb-entry-name mono">{shortName(file.path)}</span>
                  <span className="onb-entry-loc">{file.loc} LOC</span>
                </div>
                <div className="onb-entry-path mono">{file.path}</div>
                <div className="onb-entry-reason">{reason}</div>
                {file.summary && <div className="onb-entry-summary">{file.summary}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module guide */}
      <div className="card-simple" style={{ marginBottom: 16 }}>
        <div className="card-simple-head">
          <h2>{t("guide.projectModules")}</h2>
          <span className="meta">{t("guide.modulesDesc")}</span>
        </div>
        <div className="onb-modules">
          {modules.map((m) => (
            <div key={m.name} className="onb-mod">
              <div className="onb-mod-head">
                <span className="onb-mod-name mono">{m.name}</span>
                <span className="onb-mod-stats">{m.files_count} files · {(m.loc || 0).toLocaleString("en")} LOC</span>
              </div>
              {m.description && <div className="onb-mod-desc">{m.description}</div>}
              {m.dependencies && (
                <div className="onb-mod-deps">
                  {(m.dependencies.internal || []).length > 0 && (
                    <span className="onb-mod-dep-tag">
                      {t("guide.dependsOn")} {m.dependencies.internal.join(", ")}
                    </span>
                  )}
                </div>
              )}
              {m.files && m.files.length > 0 && (
                <div className="onb-mod-files">
                  {m.files.slice(0, 5).map((f) => (
                    <span key={f.path} className="onb-mod-file mono">
                      <span className="onb-mod-file-dot" style={{ background: KIND_COLORS[f.kind] || KIND_COLORS.unknown }}></span>
                      {shortName(f.path)}
                    </span>
                  ))}
                  {m.files.length > 5 && (
                    <span className="onb-mod-file muted">{t("guide.moreFiles", { n: m.files.length - 5 })}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Coupling matrix */}
      {moduleDeps.length > 1 && (
        <div className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("guide.moduleCoupling")}</h2>
            <span className="meta">{t("guide.couplingDesc")}</span>
          </div>
          <div className="onb-coupling">
            {moduleDeps
              .filter((m) => m.internal.length > 0)
              .map((m) => (
                <div key={m.name} className="onb-coupling-row">
                  <span className="onb-coupling-from mono">{m.name}</span>
                  <span className="onb-coupling-arrow">{"\u2192"}</span>
                  <div className="onb-coupling-targets">
                    {m.internal.map((t) => (
                      <span key={t} className="onb-coupling-target mono">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Conventions */}
      {conventions.length > 0 && (
        <div className="card-simple" style={{ marginBottom: 16 }}>
          <div className="card-simple-head">
            <h2>{t("guide.conventions")}</h2>
            <span className="meta">{t("guide.conventionsDesc")}</span>
          </div>
          <div className="onb-conventions">
            {conventions.map((c, i) => (
              <div key={i} className="onb-conv">
                <div className="onb-conv-title">{c.title}</div>
                <div className="onb-conv-detail">{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security status */}
      <div className="card-simple">
        <div className="card-simple-head">
          <h2>{t("guide.security")}</h2>
        </div>
        <div className="onb-security">
          <div className={"onb-sec-badge " + (audit.length === 0 ? "ok" : "warn")}>
            {audit.length === 0
              ? t("guide.noVulns")
              : t("guide.vulnsDetected", { n: audit.length })}
          </div>
          <div className="onb-sec-stats">
            <span>{t("guide.prodDeps", { n: deps.filter((d) => d.kind === "prod").length })}</span>
            <span>{t("guide.devDeps", { n: deps.filter((d) => d.kind === "dev").length })}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
