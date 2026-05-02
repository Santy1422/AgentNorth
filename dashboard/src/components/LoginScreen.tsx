"use client";

import { useState, useEffect } from "react";

const FEED_DEMO = [
  { who: "Claude", verb: "called", obj: 'get_context("auth")', tag: "-57K tokens", time: "now" },
  { who: "Claude", verb: "prevented rewrite of", obj: "formatTenantId()", tag: "-3.1K tokens", time: "2m" },
  { who: "Dev", verb: "logged decision", obj: "JWT bearer over cookies", tag: "pinned", time: "14m" },
  { who: "Claude", verb: "read bundle for", obj: "module: billing", tag: "-71K tokens", time: "44m" },
];

const COUNTER_START = 284142;

const STATS = [
  { num: "96.6%", label: "Token reduction" },
  { num: "1 call", label: "vs 47 file reads" },
  { num: "$0.006", label: "vs $0.19/session" },
];

const FEATURES = [
  {
    icon: "\u26A1",
    title: "AST-Powered Indexing",
    desc: "Exports, imports, complexity, git blame, change frequency, JSDoc — all extracted via ast-grep and bundled per module.",
  },
  {
    icon: "\uD83D\uDCCC",
    title: "Persistent Decisions",
    desc: "Architecture decisions travel with the codebase. Agents check them before acting — no more contradictions across sessions.",
  },
  {
    icon: "\uD83D\uDEE1\uFE0F",
    title: "Claude Code Hooks",
    desc: "Auto-generated hooks enforce context usage. Soft warnings, strict blocks, or silent audit — three enforcement levels.",
  },
  {
    icon: "\uD83D\uDCCA",
    title: "Live Dashboard",
    desc: "Health scorecard, dependency graph, architecture map, decision timeline, activity heatmap, and 15+ more views.",
  },
  {
    icon: "\uD83D\uDD04",
    title: "Bidirectional Sync",
    desc: "CLI pushes to dashboard, dashboard creates decisions back. Post-commit hooks, watch mode, real-time SSE updates.",
  },
  {
    icon: "\uD83D\uDCE6",
    title: "MCP Protocol",
    desc: "6 tools for Claude — list modules, get context, get schema, get decisions, log decision, log change. Zero config.",
  },
];

export function LoginScreen() {
  const [counter, setCounter] = useState(COUNTER_START);
  const [feedIdx, setFeedIdx] = useState(0);

  useEffect(() => {
    const i = setInterval(() => {
      setCounter((c) => c + Math.floor(800 + Math.random() * 3000));
      setFeedIdx((f) => (f + 1) % FEED_DEMO.length);
    }, 3000);
    return () => clearInterval(i);
  }, []);

  const dollars = (counter / 100000).toFixed(2);

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-left">
          <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 11, borderRadius: 7 }}>AN</div>
          <span className="landing-logo-text">AgentNorth</span>
        </div>
        <div className="landing-nav-right">
          <a href="https://npmjs.com/package/agentnorth" className="landing-link" target="_blank" rel="noreferrer">npm</a>
          <a href="https://github.com/Santy1422/AgentNorth" className="landing-link" target="_blank" rel="noreferrer">GitHub</a>
          <button className="landing-cta-sm" onClick={() => { window.location.href = "/api/auth/signin"; }}>
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-badge">Shared Context Layer for AI Coding Agents</div>
        <h1 className="landing-h1">
          Your agents share<br />
          <span className="landing-accent">one source of truth</span>
        </h1>
        <p className="landing-sub">
          Pre-indexed context, architecture decisions, and live coordination.
          One MCP call replaces hundreds of file reads — and decisions persist
          across every session, so agents never contradict past choices.
        </p>

        {/* Token savings comparison */}
        <div className="landing-comparison">
          <div className="lc-row before">
            <span className="lc-label">Before</span>
            <span className="lc-detail">47 files read</span>
            <span className="lc-tokens">62,000 tokens</span>
            <span className="lc-cost">$0.19/session</span>
          </div>
          <div className="lc-row after">
            <span className="lc-label">After</span>
            <span className="lc-detail">1 MCP call</span>
            <span className="lc-tokens">2,100 tokens</span>
            <span className="lc-cost">$0.006/session</span>
          </div>
        </div>

        <div className="landing-ctas">
          <button className="landing-cta" onClick={() => { window.location.href = "/api/auth/signin"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Get started free
          </button>
          <button className="landing-cta secondary" onClick={() => {
            navigator.clipboard.writeText("npx agentnorth init");
          }}>
            <span className="mono" style={{ color: "var(--accent)" }}>npx agentnorth init</span>
            <span className="landing-copy-hint">copy</span>
          </button>
        </div>
      </section>

      {/* Stats bar */}
      <section className="landing-stats-bar">
        {STATS.map((s) => (
          <div key={s.label} className="ls-stat">
            <div className="ls-stat-num">{s.num}</div>
            <div className="ls-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Live preview */}
      <section className="landing-preview">
        <div className="lp-window">
          <div className="lp-titlebar">
            <div className="lp-dots">
              <span></span><span></span><span></span>
            </div>
            <div className="lp-title">AgentNorth Dashboard</div>
          </div>
          <div className="lp-body">
            {/* Token counter */}
            <div className="lp-hero">
              <div className="lp-hero-label">Tokens saved with AgentNorth</div>
              <div className="lp-hero-num">{counter.toLocaleString("en")}</div>
              <div className="lp-hero-sub">
                {"\u2248"} <span style={{ color: "var(--green)", fontWeight: 600 }}>${dollars}</span> in API costs
              </div>
              <div className="lp-bar">
                <div className="lp-bar-fill"></div>
              </div>
              <div className="lp-bar-labels">
                <span>Without AgentNorth</span>
                <span>With AgentNorth</span>
              </div>
            </div>

            {/* Mini feed */}
            <div className="lp-feed">
              {FEED_DEMO.map((f, i) => (
                <div key={i} className={"lp-feed-row" + (i === feedIdx ? " active" : "")}>
                  <div className={"lp-avatar" + (f.who === "Claude" ? " claude" : "")}>
                    {f.who === "Claude" ? "C" : f.who[0]}
                  </div>
                  <div className="lp-feed-body">
                    <span className="lp-feed-who">{f.who}</span>
                    <span className="lp-feed-verb"> {f.verb} </span>
                    <span className="lp-feed-obj">{f.obj}</span>
                  </div>
                  <span className="lp-feed-tag">{f.tag}</span>
                  <span className="lp-feed-time">{f.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <h2 className="landing-h2">How it works</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="ls-num">1</div>
            <div className="ls-content">
              <h3>Index your codebase</h3>
              <p><span className="mono">npx agentnorth init && npx agentnorth index</span></p>
              <p className="ls-desc">AST parsing (ast-grep), git blame, complexity analysis, schema detection. Creates enriched bundles per module.</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">2</div>
            <div className="ls-content">
              <h3>Wire into Claude Code</h3>
              <p><span className="mono">npx agentnorth setup</span></p>
              <p className="ls-desc">Generates MCP config, Claude Code hooks (SessionStart, PreToolUse, PostToolUse), and CLAUDE.md instructions.</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">3</div>
            <div className="ls-content">
              <h3>Agents read context, not files</h3>
              <p><span className="mono">agentnorth_get_context("auth")</span></p>
              <p className="ls-desc">Instead of reading 47 files, your agent gets 2K tokens of structured context. 96.6% reduction.</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">4</div>
            <div className="ls-content">
              <h3>Sync to live dashboard</h3>
              <p><span className="mono">npx agentnorth sync</span></p>
              <p className="ls-desc">Push modules, decisions, and changes to your dashboard. Real-time SSE updates, bidirectional sync, health tracking.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="landing-section">
        <h2 className="landing-h2">Built for teams shipping with AI</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="lf-card">
              <div className="lf-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MCP Tools table */}
      <section className="landing-section">
        <h2 className="landing-h2">6 MCP Tools for Claude</h2>
        <div className="landing-tools-table">
          <div className="lt-tool-row header">
            <span>Tool</span>
            <span>Direction</span>
            <span>What it does</span>
          </div>
          {[
            { name: "list_modules", dir: "read", desc: "List all indexed modules" },
            { name: "get_context", dir: "read", desc: "Full enriched context bundle" },
            { name: "get_schema", dir: "read", desc: "Database schema + ERD" },
            { name: "get_decisions", dir: "read", desc: "Architecture decisions for a module" },
            { name: "log_decision", dir: "write", desc: "Record an architecture decision" },
            { name: "log_change", dir: "write", desc: "Record a code change" },
          ].map((t) => (
            <div key={t.name} className="lt-tool-row">
              <span className="mono">{t.name}</span>
              <span className={"lt-dir " + t.dir}>{t.dir}</span>
              <span>{t.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Setup snippet */}
      <section className="landing-section">
        <h2 className="landing-h2">Up and running in 60 seconds</h2>
        <div className="landing-terminal">
          <div className="lt-bar">
            <div className="lp-dots"><span></span><span></span><span></span></div>
            <span className="lt-title">Terminal</span>
          </div>
          <div className="lt-body">
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth init</div>
            <div className="lt-output">Detected framework + modules {"\u00B7"} Created .agentnorth/config.yaml</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth index</div>
            <div className="lt-output">AST parsing + git blame + complexity analysis {"\u00B7"} Bundles ready</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth setup</div>
            <div className="lt-output">MCP server + Claude Code hooks + CLAUDE.md {"\u00B7"} Wired</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth sync</div>
            <div className="lt-output">Pushed to dashboard {"\u00B7"} Real-time SSE active</div>
            <div className="lt-line"><span className="lt-prompt">$</span> <span className="lt-cursor">_</span></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-final">
        <h2 className="landing-h2">Stop wasting tokens.<br/>Start shipping faster.</h2>
        <p className="landing-sub" style={{ maxWidth: 520, margin: "0 auto 32px" }}>
          Free and open source. No credit card required. Works with Claude Code today.
        </p>
        <div className="landing-ctas">
          <button className="landing-cta" onClick={() => { window.location.href = "/api/auth/signin"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>AgentNorth &mdash; Apache-2.0</span>
        <span>&middot;</span>
        <a href="https://github.com/Santy1422/AgentNorth" target="_blank" rel="noreferrer">GitHub</a>
        <span>&middot;</span>
        <a href="https://npmjs.com/package/agentnorth" target="_blank" rel="noreferrer">npm</a>
      </footer>
    </div>
  );
}
