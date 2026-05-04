"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useT } from "@/i18n/provider";
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
import { SessionsView } from "@/components/SessionsView";

export type View = "main" | "map" | "deps" | "coverage" | "risks" | "apis" | "onboarding" | "module-detail" | "graph" | "sessions";

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
  tokens_saved_total: number;
  tokens_input?: number;
  tokens_output?: number;
  events_count?: number;
  modules_visited?: string[];
  tools_used?: string[];
  files_touched?: string[];
  branch?: string;
  repo_url?: string;
  files_changed_count?: number;
  changes_logged?: number;
  decisions_logged?: number;
  errors_count?: number;
  commit_shas?: string[];
  claude_model?: string;
  conversation_id?: string;
  duration_mins?: number;
  edits_count?: number;
  bash_commands_count?: number;
  tokens_cache_read?: number;
  tokens_cache_creation?: number;
  assistant_turns?: number;
  user_turns?: number;
  tool_calls?: Record<string, number>;
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
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function buildFeed(data: DashboardData, t: (key: string, vars?: Record<string, string | number>) => string): FeedRow[] {
  const rows: { row: FeedRow; ts: number }[] = [];

  for (const d of data.decisions) {
    rows.push({
      ts: new Date(d.created_at).getTime(),
      row: {
        id: d._id,
        kind: "decision",
        who: d.author_name && d.author_name !== "agent" && d.author_name !== "unknown"
          ? d.author_name
          : "agent",
        verb: t("feed.loggedDecision"),
        obj: d.title,
        detail: d.decision || d.context || "",
        ago: timeAgo(d.created_at),
        badges: [
          { t: d.status || "active", c: "violet" },
          ...(d.module ? [{ t: d.module, c: "" }] : []),
        ],
      },
    });
  }

  for (const c of data.changes) {
    rows.push({
      ts: new Date(c.created_at).getTime(),
      row: {
        id: c._id,
        kind: "doc",
        who: "agent",
        verb: c.breaking ? t("feed.breakingChange") : t("feed.modified"),
        obj: c.summary,
        detail: c.files_changed?.length
          ? `${c.files_changed.length} file${c.files_changed.length > 1 ? "s" : ""}: ${c.files_changed.slice(0, 3).map((f) => f.split("/").pop()).join(", ")}${c.files_changed.length > 3 ? "…" : ""}`
          : "",
        ago: timeAgo(c.created_at),
        badges: c.breaking ? [{ t: "breaking", c: "accent" }] : [{ t: t("common.change"), c: "blue" }],
      },
    });
  }

  for (const e of data.events) {
    rows.push({
      ts: new Date(e.timestamp).getTime(),
      row: {
        id: e._id,
        kind: "claude",
        who: e.dev_id?.name || "agent",
        verb: e.action?.replace(/_/g, " ") || "event",
        obj: e.module || "",
        detail: "",
        ago: timeAgo(e.timestamp),
        badges: e.tokens_saved_estimate
          ? [{ t: `-${(e.tokens_saved_estimate / 1000).toFixed(1)}k tokens`, c: "accent" }]
          : [],
      },
    });
  }

  // Add session info to feed
  for (const s of data.sessions) {
    if (s.ended_at) {
      const duration = Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
      rows.push({
        ts: new Date(s.ended_at).getTime(),
        row: {
          id: s._id + "-end",
          kind: "session",
          who: s.dev_id?.name || "agent",
          verb: t("feed.sessionEnded"),
          obj: `${duration}min`,
          detail: s.tokens_saved_total ? t("feed.saved", { n: (s.tokens_saved_total / 1000).toFixed(1) }) : "",
          ago: timeAgo(s.ended_at),
          badges: [{ t: t("common.session"), c: "" }],
        },
      });
    } else {
      rows.push({
        ts: new Date(s.started_at).getTime(),
        row: {
          id: s._id + "-start",
          kind: "session",
          who: s.dev_id?.name || "agent",
          verb: t("feed.sessionActive"),
          obj: "",
          detail: "",
          ago: timeAgo(s.started_at),
          badges: [{ t: "live", c: "accent" }],
          fresh: true,
        },
      });
    }
  }

  // Sort by actual timestamp, newest first
  rows.sort((a, b) => b.ts - a.ts);

  return rows.slice(0, 12).map((r) => r.row);
}

export default function Home() {
  const { t } = useT();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [view, setView] = useState<View>("main");
  const [data, setData] = useState<DashboardData | null>(null);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [savedTokens, setSavedTokens] = useState(0);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRef | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

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
      setFeedRows(buildFeed(d, t));
      setLastRefresh(new Date());
      setAuthState("ready");
    } catch {
      setAuthState("unauthenticated");
    }
  }, [t]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time SSE with auto-reconnect + exponential backoff
  const sseRef = useRef<{ es: EventSource | null; retries: number; timer: ReturnType<typeof setTimeout> | null }>({
    es: null, retries: 0, timer: null,
  });

  useEffect(() => {
    if (authState !== "ready" || !activeProject?.id) return;

    const projectId = activeProject.id;
    const state = sseRef.current;
    let disposed = false;

    function connect() {
      if (disposed) return;

      // Clean previous
      state.es?.close();
      state.es = null;

      const es = new EventSource(`/api/stream?project=${projectId}`);
      state.es = es;

      es.addEventListener("connected", () => {
        // Connection established — reset backoff
        state.retries = 0;
        setIsLive(true);
      });

      es.addEventListener("heartbeat", () => {
        // Keep-alive received — connection is healthy
        setIsLive(true);
      });

      es.addEventListener("sync", (e) => {
        // Full sync happened — refresh all data
        setIsLive(true);
        fetchDashboard(projectId);
      });

      es.addEventListener("event", (e) => {
        // Inline event update — update tokens without full refetch
        try {
          const payload = JSON.parse(e.data);
          if (payload.tokens_saved) {
            setSavedTokens((prev) => prev + payload.tokens_saved);
          }
          // Add to feed inline
          if (payload.action) {
            setFeedRows((prev) => {
              const row: FeedRow = {
                id: `sse-${Date.now()}`,
                kind: "claude",
                who: "Claude",
                verb: payload.action?.replace(/_/g, " ") || "event",
                obj: payload.module || "",
                detail: "",
                ago: t("common.now"),
                badges: payload.tokens_saved
                  ? [{ t: `-${(payload.tokens_saved / 1000).toFixed(1)}k tokens`, c: "accent" }]
                  : [],
                fresh: true,
              };
              return [row, ...prev].slice(0, 10);
            });
          }
        } catch {
          // Fallback: full refetch
          fetchDashboard(projectId);
        }
      });

      es.addEventListener("decision", () => {
        fetchDashboard(projectId);
      });

      es.addEventListener("session", () => {
        // Session start/end — refresh
        fetchDashboard(projectId);
      });

      es.onerror = () => {
        setIsLive(false);
        es.close();
        state.es = null;

        if (disposed) return;

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, state.retries), 30000);
        state.retries++;
        state.timer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      disposed = true;
      state.es?.close();
      state.es = null;
      if (state.timer) clearTimeout(state.timer);
      state.retries = 0;
    };
  }, [authState, fetchDashboard, activeProject, t]);

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 18, borderRadius: 12, animation: "pulse 1.5s infinite" }}>AN</div>
          <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        </div>
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
        isLive={isLive}
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
            sessions={data?.sessions || []}
            projectName={activeProject?.name}
            onRefresh={() => fetchDashboard(activeProject?.id)}
          />
        )}
        {view === "apis" && <ApisView modules={data?.project.modules || []} />}
        {view === "graph" && <DependencyGraph modules={data?.project.modules || []} />}
        {view === "sessions" && <SessionsView sessions={data?.sessions || []} />}
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
