import { describe, it, expect } from "vitest";

// ---------- Recreate pure functions from page.tsx (they are not exported) ----------

interface FeedRow {
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

interface DashboardData {
  decisions: {
    _id: string;
    module: string;
    title: string;
    context?: string;
    decision?: string;
    author_name: string;
    status: string;
    created_at: string;
  }[];
  changes: {
    _id: string;
    module: string;
    summary: string;
    files_changed: string[];
    breaking: boolean;
    created_at: string;
  }[];
  events: {
    _id: string;
    action: string;
    module: string;
    dev_id: { name?: string } | null;
    tokens_saved_estimate: number;
    timestamp: string;
  }[];
  sessions: {
    _id: string;
    dev_id: { name?: string } | null;
    started_at: string;
    ended_at: string | null;
    tokens_saved_total: number;
  }[];
}

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

function buildFeed(
  data: DashboardData,
  t: (key: string, vars?: Record<string, string | number>) => string,
): FeedRow[] {
  const rows: { row: FeedRow; ts: number }[] = [];

  for (const d of data.decisions) {
    rows.push({
      ts: new Date(d.created_at).getTime(),
      row: {
        id: d._id,
        kind: "decision",
        who:
          d.author_name &&
          d.author_name !== "agent" &&
          d.author_name !== "unknown"
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
          ? `${c.files_changed.length} file${c.files_changed.length > 1 ? "s" : ""}: ${c.files_changed
              .slice(0, 3)
              .map((f) => f.split("/").pop())
              .join(", ")}${c.files_changed.length > 3 ? "..." : ""}`
          : "",
        ago: timeAgo(c.created_at),
        badges: c.breaking
          ? [{ t: "breaking", c: "accent" }]
          : [{ t: t("common.change"), c: "blue" }],
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
          ? [
              {
                t: `-${(e.tokens_saved_estimate / 1000).toFixed(1)}k tokens`,
                c: "accent",
              },
            ]
          : [],
      },
    });
  }

  for (const s of data.sessions) {
    if (s.ended_at) {
      const duration = Math.round(
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
          60000,
      );
      rows.push({
        ts: new Date(s.ended_at).getTime(),
        row: {
          id: s._id + "-end",
          kind: "session",
          who: s.dev_id?.name || "agent",
          verb: t("feed.sessionEnded"),
          obj: `${duration}min`,
          detail: s.tokens_saved_total
            ? t("feed.saved", {
                n: (s.tokens_saved_total / 1000).toFixed(1),
              })
            : "",
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

  rows.sort((a, b) => b.ts - a.ts);
  return rows.slice(0, 12).map((r) => r.row);
}

// ---------- Simple t() stub ----------

function t(key: string, vars?: Record<string, string | number>): string {
  const map: Record<string, string> = {
    "feed.loggedDecision": "logged decision",
    "feed.modified": "modified",
    "feed.breakingChange": "breaking change",
    "feed.sessionEnded": "session ended",
    "feed.sessionActive": "session active",
    "feed.saved": "saved ~{n}k tokens",
    "common.change": "change",
    "common.session": "session",
  };
  let val = map[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      val = val.replace(`{${k}}`, String(v));
    }
  }
  return val;
}

// ---------- Tests ----------

describe("timeAgo", () => {
  it("returns empty string for empty input", () => {
    expect(timeAgo("")).toBe("");
  });

  it("returns 'now' for a date less than 1 minute ago", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("now");
  });

  it("returns minutes for dates < 60 min ago", () => {
    const date = new Date(Date.now() - 5 * 60000).toISOString();
    expect(timeAgo(date)).toBe("5m");
  });

  it("returns hours for dates < 24h ago", () => {
    const date = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(timeAgo(date)).toBe("3h");
  });

  it("returns days for dates >= 24h ago", () => {
    const date = new Date(Date.now() - 48 * 3600000).toISOString();
    expect(timeAgo(date)).toBe("2d");
  });

  it("handles exactly 60 minutes as 1h", () => {
    const date = new Date(Date.now() - 60 * 60000).toISOString();
    expect(timeAgo(date)).toBe("1h");
  });

  it("handles exactly 24 hours as 1d", () => {
    const date = new Date(Date.now() - 24 * 3600000).toISOString();
    expect(timeAgo(date)).toBe("1d");
  });
});

describe("buildFeed", () => {
  const now = Date.now();

  function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
    return {
      decisions: [],
      changes: [],
      events: [],
      sessions: [],
      ...overrides,
    };
  }

  it("returns empty array when no data", () => {
    expect(buildFeed(makeData(), t)).toEqual([]);
  });

  it("sorts entries by timestamp (newest first)", () => {
    const data = makeData({
      decisions: [
        {
          _id: "d1",
          module: "core",
          title: "Old decision",
          author_name: "Alice",
          status: "active",
          created_at: new Date(now - 100000).toISOString(),
        },
      ],
      events: [
        {
          _id: "e1",
          action: "get_context",
          module: "core",
          dev_id: { name: "Bob" },
          tokens_saved_estimate: 5000,
          timestamp: new Date(now - 1000).toISOString(),
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].id).toBe("e1");
    expect(feed[1].id).toBe("d1");
  });

  it("limits results to 12 entries", () => {
    const decisions = Array.from({ length: 15 }, (_, i) => ({
      _id: `d${i}`,
      module: "m",
      title: `Decision ${i}`,
      author_name: "agent",
      status: "active",
      created_at: new Date(now - i * 1000).toISOString(),
    }));

    const feed = buildFeed(makeData({ decisions }), t);
    expect(feed.length).toBe(12);
  });

  it("builds decision rows correctly", () => {
    const data = makeData({
      decisions: [
        {
          _id: "d1",
          module: "auth",
          title: "Use JWT",
          decision: "We chose JWT for stateless auth",
          author_name: "Alice",
          status: "active",
          created_at: new Date(now - 5000).toISOString(),
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed).toHaveLength(1);
    expect(feed[0].kind).toBe("decision");
    expect(feed[0].who).toBe("Alice");
    expect(feed[0].verb).toBe("logged decision");
    expect(feed[0].obj).toBe("Use JWT");
    expect(feed[0].detail).toBe("We chose JWT for stateless auth");
    expect(feed[0].badges).toEqual(
      expect.arrayContaining([
        { t: "active", c: "violet" },
        { t: "auth", c: "" },
      ]),
    );
  });

  it("uses 'agent' as who when author_name is 'unknown'", () => {
    const data = makeData({
      decisions: [
        {
          _id: "d1",
          module: "core",
          title: "X",
          author_name: "unknown",
          status: "active",
          created_at: new Date().toISOString(),
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].who).toBe("agent");
  });

  it("builds change rows (non-breaking)", () => {
    const data = makeData({
      changes: [
        {
          _id: "c1",
          module: "ui",
          summary: "Refactored header",
          files_changed: ["src/Header.tsx", "src/Nav.tsx"],
          breaking: false,
          created_at: new Date(now - 1000).toISOString(),
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].kind).toBe("doc");
    expect(feed[0].verb).toBe("modified");
    expect(feed[0].badges).toEqual([{ t: "change", c: "blue" }]);
    expect(feed[0].detail).toContain("2 files");
  });

  it("builds breaking change rows", () => {
    const data = makeData({
      changes: [
        {
          _id: "c1",
          module: "api",
          summary: "Remove v1 endpoints",
          files_changed: ["src/api/v1.ts"],
          breaking: true,
          created_at: new Date(now - 1000).toISOString(),
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].verb).toBe("breaking change");
    expect(feed[0].badges).toEqual([{ t: "breaking", c: "accent" }]);
  });

  it("builds event rows with token badges", () => {
    const data = makeData({
      events: [
        {
          _id: "e1",
          action: "get_context",
          module: "core",
          dev_id: { name: "Bob" },
          tokens_saved_estimate: 5000,
          timestamp: new Date(now - 1000).toISOString(),
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].kind).toBe("claude");
    expect(feed[0].who).toBe("Bob");
    expect(feed[0].verb).toBe("get context");
    expect(feed[0].badges![0].t).toBe("-5.0k tokens");
  });

  it("builds ended session rows", () => {
    const start = new Date(now - 600000).toISOString(); // 10 min ago
    const end = new Date(now - 60000).toISOString(); // 1 min ago

    const data = makeData({
      sessions: [
        {
          _id: "s1",
          dev_id: { name: "Dev" },
          started_at: start,
          ended_at: end,
          tokens_saved_total: 12000,
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].kind).toBe("session");
    expect(feed[0].id).toBe("s1-end");
    expect(feed[0].verb).toBe("session ended");
    expect(feed[0].obj).toBe("9min");
    expect(feed[0].detail).toBe("saved ~12.0k tokens");
  });

  it("builds active session rows with fresh flag", () => {
    const data = makeData({
      sessions: [
        {
          _id: "s2",
          dev_id: null,
          started_at: new Date(now - 30000).toISOString(),
          ended_at: null,
          tokens_saved_total: 0,
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed[0].id).toBe("s2-start");
    expect(feed[0].verb).toBe("session active");
    expect(feed[0].fresh).toBe(true);
    expect(feed[0].badges).toEqual([{ t: "live", c: "accent" }]);
  });

  it("includes all event types mixed and sorted", () => {
    const data = makeData({
      decisions: [
        {
          _id: "d1",
          module: "m",
          title: "D",
          author_name: "a",
          status: "active",
          created_at: new Date(now - 4000).toISOString(),
        },
      ],
      changes: [
        {
          _id: "c1",
          module: "m",
          summary: "C",
          files_changed: [],
          breaking: false,
          created_at: new Date(now - 3000).toISOString(),
        },
      ],
      events: [
        {
          _id: "e1",
          action: "x",
          module: "m",
          dev_id: null,
          tokens_saved_estimate: 0,
          timestamp: new Date(now - 2000).toISOString(),
        },
      ],
      sessions: [
        {
          _id: "s1",
          dev_id: null,
          started_at: new Date(now - 1000).toISOString(),
          ended_at: null,
          tokens_saved_total: 0,
        },
      ],
    });

    const feed = buildFeed(data, t);
    expect(feed).toHaveLength(4);
    expect(feed.map((r) => r.kind)).toEqual([
      "session",
      "claude",
      "doc",
      "decision",
    ]);
  });
});
