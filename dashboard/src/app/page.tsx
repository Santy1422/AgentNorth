"use client";

import { useState, useEffect, useCallback } from "react";
import {
  SESSIONS as MOCK_SESSIONS,
  FEED_SEED,
  FEED_TICKER,
  type FeedRow,
  type Session as MockSession,
} from "@/data/mock";
import { Header } from "@/components/Header";
import { MainView } from "@/components/MainView";
import { MapView } from "@/components/MapView";
import { CoverageView } from "@/components/CoverageView";
import { RisksView } from "@/components/RisksView";
import { SkillsView } from "@/components/SkillsView";
import { LoginScreen } from "@/components/LoginScreen";
import { OnboardingScreen } from "@/components/OnboardingScreen";

export type View = "main" | "map" | "coverage" | "risks" | "skills";

export interface ProjectRef {
  id: string;
  name: string;
}

type AuthState = "loading" | "unauthenticated" | "no-projects" | "ready";

interface DashboardData {
  project: { id: string; name: string; modules: any[] };
  decisions: any[];
  changes: any[];
  sessions: any[];
  events: any[];
  tokens_saved: number;
  total_events: number;
}

function mapEventsToFeed(data: DashboardData): FeedRow[] {
  const rows: FeedRow[] = [];

  for (const d of data.decisions.slice(0, 4)) {
    rows.push({
      id: d._id,
      kind: "decision",
      who: d.author_name === "agent" ? "claude" : d.author_name || "unknown",
      verb: "fijo decision",
      obj: d.title,
      detail: d.decision || d.context || "",
      ago: timeAgo(d.created_at),
      badges: [{ t: "pinned", c: "violet" }, { t: d.module || "", c: "" }],
    });
  }

  for (const c of data.changes.slice(0, 4)) {
    rows.push({
      id: c._id,
      kind: "doc",
      who: "claude",
      verb: "modifico",
      obj: c.summary,
      detail: `${c.files_changed?.length || 0} archivos${c.breaking ? " · BREAKING" : ""}`,
      ago: timeAgo(c.created_at),
      badges: c.breaking
        ? [{ t: "breaking", c: "accent" }]
        : [{ t: "cambio", c: "blue" }],
    });
  }

  for (const e of data.events.slice(0, 4)) {
    rows.push({
      id: e._id,
      kind: "claude",
      who: "claude",
      verb: e.action?.replace(/_/g, " ") || "evento",
      obj: e.module || "",
      detail: "",
      ago: timeAgo(e.timestamp),
      badges: e.tokens_saved_estimate
        ? [{ t: `-${(e.tokens_saved_estimate / 1000).toFixed(1)}k tokens`, c: "accent" }]
        : [],
      by: (e.dev_id as any)?.name || undefined,
    });
  }

  rows.sort((a, b) => {
    if (a.ago === "ahora") return -1;
    if (b.ago === "ahora") return 1;
    return 0;
  });

  return rows.slice(0, 8);
}

function mapSessions(data: DashboardData): MockSession[] {
  return data.sessions.slice(0, 4).map((s: any, i: number) => ({
    id: s._id,
    who: (s.dev_id as any)?.name || "agent",
    status: s.ended_at ? "done" : "live",
    task: `Session ${i + 1}`,
    file: "",
    bundle: "",
    progress: s.ended_at ? 100 : 50,
    tokens: s.tokens_used || 0,
    cap: 80000,
    saved: s.tokens_saved || 0,
    ago: timeAgo(s.started_at),
  }));
}

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

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [view, setView] = useState<View>("main");
  const [feedRows, setFeedRows] = useState<FeedRow[]>(FEED_SEED.slice(0, 6));
  const [sessions, setSessions] = useState<MockSession[]>(MOCK_SESSIONS);
  const [savedTokens, setSavedTokens] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRef | null>(null);

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

      const data = json.data as DashboardData;
      setActiveProject({ id: data.project.id, name: data.project.name });
      setSavedTokens(data.tokens_saved || 0);
      setIsLive(true);
      setAuthState("ready");

      const realFeed = mapEventsToFeed(data);
      if (realFeed.length > 0) {
        setFeedRows(realFeed);
      }

      const realSessions = mapSessions(data);
      if (realSessions.length > 0) {
        setSessions(realSessions);
      }
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const switchProject = useCallback((p: ProjectRef) => {
    setActiveProject(p);
    setFeedRows(FEED_SEED.slice(0, 6));
    setSessions(MOCK_SESSIONS);
    setSavedTokens(0);
    fetchDashboard(p.id);
  }, [fetchDashboard]);

  // Live ticker / polling
  useEffect(() => {
    if (authState !== "ready") return;

    if (isLive) {
      const i = setInterval(() => {
        fetchDashboard(activeProject?.id);
      }, 15000);
      return () => clearInterval(i);
    }

    const i = setInterval(() => {
      setFeedRows((rows) => {
        const next = FEED_TICKER[Math.floor(Math.random() * FEED_TICKER.length)];
        return [
          { ...next, id: "t" + Date.now(), ago: "ahora", fresh: true },
          ...rows,
        ].slice(0, 8);
      });
      setSavedTokens((s) => s + Math.floor(800 + Math.random() * 4000));
    }, 5000);
    return () => clearInterval(i);
  }, [authState, isLive, fetchDashboard, activeProject]);

  // Loading state
  if (authState === "loading") {
    return (
      <div className="loading-screen">
        <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 18, borderRadius: 12, animation: "pulse 1.5s infinite" }}>AN</div>
      </div>
    );
  }

  // Not logged in
  if (authState === "unauthenticated") {
    return <LoginScreen />;
  }

  // Logged in but no projects
  if (authState === "no-projects") {
    return <OnboardingScreen />;
  }

  // Dashboard
  return (
    <div className="simple-app">
      <Header
        view={view}
        setView={setView}
        projects={projects}
        activeProject={activeProject}
        onSwitchProject={switchProject}
        isLive={isLive}
      />
      <main className="simple-main">
        {view === "main" && (
          <MainView feedRows={feedRows} savedTokens={savedTokens} sessions={sessions} isLive={isLive} />
        )}
        {view === "map" && <MapView />}
        {view === "coverage" && <CoverageView />}
        {view === "risks" && <RisksView />}
        {view === "skills" && <SkillsView />}
      </main>
    </div>
  );
}
