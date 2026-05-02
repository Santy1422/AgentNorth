"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { MainView } from "@/components/MainView";
import { MapView } from "@/components/MapView";
import { DepsView } from "@/components/DepsView";
import { CoverageView } from "@/components/CoverageView";
import { RisksView } from "@/components/RisksView";
import { ApisView } from "@/components/ApisView";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { ModuleDetail } from "@/components/ModuleDetail";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LoginScreen } from "@/components/LoginScreen";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { DependencyGraph } from "@/components/DependencyGraph";

export type View = "main" | "map" | "deps" | "coverage" | "risks" | "apis" | "onboarding" | "module-detail" | "graph";

export interface ProjectRef {
  id: string;
  name: string;
}

export interface FileData {
  path: string;
  exports: string[];
  imports: { source: string; specifiers: string[] }[];
  kind: string;
  loc: number;
  summary: string;
  complexity?: number;
  has_default_export?: boolean;
  type_exports?: string[];
  jsdoc?: string[];
  last_modified?: string;
  authors?: { author: string; lines: number }[];
  change_frequency?: number;
}

export interface ContributorData {
  name: string;
  commits: number;
  last_active: string;
}

export interface ModuleData {
  name: string;
  description: string;
  paths: string[];
  files_count: number;
  files?: FileData[];
  loc: number;
  exports_count: number;
  dependencies?: {
    internal: string[];
    external: string[];
  };
  contributors?: ContributorData[];
  warnings?: string[];
  recent_changes?: { commit: string; date: string; author: string; summary: string; files_changed: string[] }[];
}

export interface DecisionData {
  _id: string;
  module: string;
  title: string;
  context?: string;
  decision?: string;
  author_name: string;
  status: string;
  created_at: string;
}

export interface ChangeData {
  _id: string;
  module: string;
  summary: string;
  files_changed: string[];
  breaking: boolean;
  created_at: string;
}

export interface SessionData {
  _id: string;
  dev_id: { name?: string } | null;
  started_at: string;
  ended_at: string | null;
  tokens_total: number;
  tokens_saved_total: number;
}

export interface EventData {
  _id: string;
  action: string;
  module: string;
  dev_id: { name?: string } | null;
  tokens_saved_estimate: number;
  timestamp: string;
}

export interface DepData {
  name: string;
  version: string;
  kind: "prod" | "dev";
  source: string;
}

export interface AuditVuln {
  name: string;
  severity: string;
  title: string;
  url: string;
  range: string;
}

export interface HealthSnapshotData {
  score: number;
  modules_count: number;
  files_count: number;
  loc: number;
  dead_files: number;
  vuln_count: number;
  created_at: string;
}

export interface DashboardData {
  project: { id: string; name: string; modules: ModuleData[]; deps: DepData[]; audit: AuditVuln[] };
  decisions: DecisionData[];
  changes: ChangeData[];
  sessions: SessionData[];
  events: EventData[];
  tokens_saved: number;
  total_events: number;
  health_history?: HealthSnapshotData[];
}

export interface FeedRow {
  id: string;
  kind: string;
  who: string;
  verb: string;
  obj: string;
  detail: string;
  ago: string;
  badges?: { t: string; c: string }[];
  fresh?: boolean;
}

type AuthState = "loading" | "unauthenticated" | "no-projects" | "ready";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function buildFeed(data: DashboardData): FeedRow[] {
  const rows: FeedRow[] = [];

  for (const d of data.decisions.slice(0, 5)) {
    rows.push({
      id: d._id,
      kind: "decision",
      who: d.author_name === "agent" ? "Claude" : d.author_name || "unknown",
      verb: "fijo decision",
      obj: d.title,
      detail: d.decision || d.context || "",
      ago: timeAgo(d.created_at),
      badges: [{ t: "pinned", c: "violet" }, { t: d.module || "", c: "" }],
    });
  }

  for (const c of data.changes.slice(0, 5)) {
    rows.push({
      id: c._id,
      kind: "doc",
      who: "Claude",
      verb: "modifico",
      obj: c.summary,
      detail: `${c.files_changed?.length || 0} archivos${c.breaking ? " · BREAKING" : ""}`,
      ago: timeAgo(c.created_at),
      badges: c.breaking ? [{ t: "breaking", c: "accent" }] : [{ t: "cambio", c: "blue" }],
    });
  }

  for (const e of data.events.slice(0, 5)) {
    rows.push({
      id: e._id,
      kind: "claude",
      who: "Claude",
      verb: e.action?.replace(/_/g, " ") || "evento",
      obj: e.module || "",
      detail: "",
      ago: timeAgo(e.timestamp),
      badges: e.tokens_saved_estimate
        ? [{ t: `-${(e.tokens_saved_estimate / 1000).toFixed(1)}k tokens`, c: "accent" }]
        : [],
    });
  }

  rows.sort((a, b) => {
    if (a.ago === "ahora") return -1;
    if (b.ago === "ahora") return 1;
    return 0;
  });

  return rows.slice(0, 10);
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [view, setView] = useState<View>("main");
  const [data, setData] = useState<DashboardData | null>(null);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [savedTokens, setSavedTokens] = useState(0);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRef | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (projectId?: string) => {
    try {
      const url = projectId
        ? `/api/dashboard?project=${projectId}`
        : "/api/dashboard";
      const res = await fetch(url);
      const json = await res.json();

      if (!json.authenticated) {
        setAuthState("unauthenticated");
        return;
      }

      if (json.projects) {
        setProjects(json.projects);
      }

      if (!json.data) {
        setAuthState("no-projects");
        return;
      }

      const d = json.data as DashboardData;
      setData(d);
      setActiveProject({ id: d.project.id, name: d.project.name });
      setSavedTokens(d.tokens_saved || 0);
      setFeedRows(buildFeed(d));
      setLastRefresh(new Date());
      setAuthState("ready");
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time SSE connection + fallback polling
  useEffect(() => {
    if (authState !== "ready" || !activeProject?.id) return;

    let es: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    try {
      es = new EventSource(`/api/stream?project=${activeProject.id}`);

      es.addEventListener("sync", () => {
        // Server notified us of a sync — refresh immediately
        fetchDashboard(activeProject.id);
      });

      es.addEventListener("event", () => {
        fetchDashboard(activeProject.id);
      });

      es.addEventListener("decision", () => {
        fetchDashboard(activeProject.id);
      });

      es.onerror = () => {
        // SSE failed, fall back to polling
        es?.close();
        es = null;
        if (!fallbackInterval) {
          fallbackInterval = setInterval(() => {
            fetchDashboard(activeProject.id);
          }, 30000);
        }
      };
    } catch {
      // SSE not supported, fall back to polling
      fallbackInterval = setInterval(() => {
        fetchDashboard(activeProject.id);
      }, 30000);
    }

    return () => {
      es?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [authState, fetchDashboard, activeProject]);

  const switchProject = useCallback((p: ProjectRef) => {
    setActiveProject(p);
    setData(null);
    setFeedRows([]);
    setSavedTokens(0);
    fetchDashboard(p.id);
  }, [fetchDashboard]);

  if (authState === "loading") {
    return (
      <div className="loading-screen">
        <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 18, borderRadius: 12, animation: "pulse 1.5s infinite" }}>AN</div>
      </div>
    );
  }

  if (authState === "unauthenticated") return <LoginScreen />;
  if (authState === "no-projects") return <OnboardingScreen />;

  return (
    <div className="simple-app">
      <Header
        view={view}
        setView={setView}
        projects={projects}
        activeProject={activeProject}
        onSwitchProject={switchProject}
        isLive={true}
        lastRefresh={lastRefresh}
        onRefresh={() => fetchDashboard(activeProject?.id)}
      />
      <GlobalSearch data={data} onNavigate={setView} />
      <main className="simple-main">
        {view === "main" && (
          <MainView feedRows={feedRows} savedTokens={savedTokens} data={data} />
        )}
        {view === "map" && <MapView modules={data?.project.modules || []} />}
        {view === "deps" && <DepsView deps={data?.project.deps || []} audit={data?.project.audit || []} />}
        {view === "coverage" && (
          <CoverageView
            modules={data?.project.modules || []}
            onSelectModule={(name) => {
              setSelectedModule(name);
              setView("module-detail");
            }}
          />
        )}
        {view === "risks" && (
          <RisksView
            decisions={data?.decisions || []}
            changes={data?.changes || []}
            projectName={activeProject?.name}
            onRefresh={() => fetchDashboard(activeProject?.id)}
          />
        )}
        {view === "apis" && <ApisView modules={data?.project.modules || []} />}
        {view === "graph" && <DependencyGraph modules={data?.project.modules || []} />}
        {view === "onboarding" && <OnboardingGuide data={data} />}
        {view === "module-detail" && selectedModule && (
          <ModuleDetail
            moduleName={selectedModule}
            data={data}
            onBack={() => setView("coverage")}
            onNavigateModule={(name) => setSelectedModule(name)}
          />
        )}
      </main>
    </div>
  );
}
