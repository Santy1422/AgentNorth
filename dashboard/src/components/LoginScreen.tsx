"use client";

import { useState, useEffect } from "react";

const FEED_DEMO = [
  { who: "Claude", verb: "llamo", obj: 'get_context("auth")', tag: "-57k tokens", time: "ahora" },
  { who: "Claude", verb: "previno reescribir", obj: "formatTenantId()", tag: "-3.1k tokens", time: "2m" },
  { who: "Ana", verb: "fijo decision", obj: "no JWT en cookies httpOnly", tag: "pinned", time: "14m" },
  { who: "Claude", verb: "leyo bundle de", obj: "module: billing", tag: "-71k tokens", time: "44m" },
];

const COUNTER_START = 284142;

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
        <div className="landing-badge">Now on npm &mdash; v0.1.0</div>
        <h1 className="landing-h1">
          Your AI agents share<br />
          <span className="landing-accent">one source of truth</span>
        </h1>
        <p className="landing-sub">
          AgentNorth gives every coding agent pre-indexed context, architecture decisions,
          and live coordination &mdash; so they stop wasting tokens rediscovering your codebase.
        </p>
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
                ≈ <span style={{ color: "var(--green)", fontWeight: 600 }}>${dollars}</span> in API costs
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
              <p className="ls-desc">AgentNorth scans your repo and creates pre-indexed bundles for each module &mdash; files, exports, schemas, dependencies, all in one JSON.</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">2</div>
            <div className="ls-content">
              <h3>Agents read context, not files</h3>
              <p><span className="mono">agentnorth_get_context("auth")</span></p>
              <p className="ls-desc">Instead of grepping 200 files, your agent gets 5K tokens of structured context. 90%+ reduction in exploration tokens.</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">3</div>
            <div className="ls-content">
              <h3>Decisions stick across sessions</h3>
              <p><span className="mono">agentnorth_log_decision()</span></p>
              <p className="ls-desc">When an agent makes an architecture decision, it's recorded. Next session, different dev, different agent &mdash; same decisions respected.</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">4</div>
            <div className="ls-content">
              <h3>Dashboard shows everything</h3>
              <p className="ls-desc">Live feed of all agent activity, sessions, decisions, and changes across every repo. Multi-project, multi-user, real-time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="landing-section">
        <h2 className="landing-h2">Built for teams shipping with AI</h2>
        <div className="landing-features-grid">
          <div className="lf-card">
            <div className="lf-card-icon">&#x26A1;</div>
            <h3>Context Bundles</h3>
            <p>Pre-indexed modules with files, exports, schemas, and dependencies. One MCP call replaces hundreds of file reads.</p>
          </div>
          <div className="lf-card">
            <div className="lf-card-icon">&#x1F4CC;</div>
            <h3>Persistent Decisions</h3>
            <p>Architecture decisions travel with the codebase. Agents check them before acting &mdash; no more contradictions.</p>
          </div>
          <div className="lf-card">
            <div className="lf-card-icon">&#x1F6E1;</div>
            <h3>Claude Code Hooks</h3>
            <p>Auto-generated hooks enforce context usage. Soft warnings or hard blocks when agents skip AgentNorth.</p>
          </div>
          <div className="lf-card">
            <div className="lf-card-icon">&#x1F4CA;</div>
            <h3>Live Dashboard</h3>
            <p>Real-time feed of agent sessions, decisions, changes, and token savings across all your repositories.</p>
          </div>
          <div className="lf-card">
            <div className="lf-card-icon">&#x1F465;</div>
            <h3>Multi-User Teams</h3>
            <p>One org, many devs, many repos. Invite teammates with a link. Everyone shares the same context layer.</p>
          </div>
          <div className="lf-card">
            <div className="lf-card-icon">&#x1F4E6;</div>
            <h3>MCP Protocol</h3>
            <p>Standard MCP server works with Claude Code out of the box. 6 tools, zero config, just <span className="mono">npx agentnorth serve</span>.</p>
          </div>
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
            <div className="lt-output">Detected: Next.js + TypeScript · Found 6 modules · Created .agentnorth/config.yaml</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth index</div>
            <div className="lt-output">Indexed 6 modules · 312 files · 48.2K LOC · Bundles written to .agentnorth/bundles/</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth setup</div>
            <div className="lt-output">Created .claude/settings.json · 4 hooks · CLAUDE.md</div>
            <div className="lt-line"><span className="lt-prompt">$</span> <span className="lt-cursor">_</span></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-final">
        <h2 className="landing-h2">Stop wasting tokens.<br/>Start shipping faster.</h2>
        <p className="landing-sub" style={{ maxWidth: 500, margin: "0 auto 32px" }}>
          Free for open source. No credit card. Works with Claude Code today.
        </p>
        <div className="landing-ctas">
          <button className="landing-cta" onClick={() => { window.location.href = "/api/auth/signin"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Get started free
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
