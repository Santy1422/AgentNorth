"use client";

import { useState, useEffect } from "react";
import { useT } from "@/i18n/provider";

const FEED_DEMO = [
  { who: "Claude", verb: "called", obj: 'get_context("auth")', tag: "-57K tokens", time: "now" },
  { who: "Claude", verb: "prevented rewrite of", obj: "formatTenantId()", tag: "-3.1K tokens", time: "2m" },
  { who: "Dev", verb: "logged decision", obj: "JWT bearer over cookies", tag: "pinned", time: "14m" },
  { who: "Claude", verb: "read bundle for", obj: "module: billing", tag: "-71K tokens", time: "44m" },
];

const COUNTER_START = 284142;

const FEATURE_ICONS = ["\u26A1", "\uD83D\uDCCC", "\uD83D\uDEE1\uFE0F", "\uD83D\uDCCA", "\uD83D\uDD04", "\uD83D\uDCE6"];

export function LoginScreen() {
  const { t } = useT();
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
            {t("login.signIn")}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-badge">{t("login.tagline")}</div>
        <h1 className="landing-h1">
          {t("login.heroPrefix")}<br />
          <span className="landing-accent">{t("login.heroHighlight")}</span>
        </h1>
        <p className="landing-sub">
          {t("login.heroDesc")}
        </p>

        {/* Token savings comparison */}
        <div className="landing-comparison">
          <div className="lc-row before">
            <span className="lc-label">{t("login.before")}</span>
            <span className="lc-detail">{t("login.filesRead")}</span>
            <span className="lc-tokens">{t("login.tokensOld")}</span>
            <span className="lc-cost">{t("login.costOld")}</span>
          </div>
          <div className="lc-row after">
            <span className="lc-label">{t("login.after")}</span>
            <span className="lc-detail">{t("login.mpcCall")}</span>
            <span className="lc-tokens">{t("login.tokensNew")}</span>
            <span className="lc-cost">{t("login.costNew")}</span>
          </div>
        </div>

        <div className="landing-ctas">
          <button className="landing-cta" onClick={() => { window.location.href = "/api/auth/signin"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            {t("login.getStarted")}
          </button>
          <button className="landing-cta secondary" onClick={() => {
            navigator.clipboard.writeText("npx agentnorth init");
          }}>
            <span className="mono" style={{ color: "var(--accent)" }}>npx agentnorth init</span>
            <span className="landing-copy-hint">{t("login.copy")}</span>
          </button>
        </div>
      </section>

      {/* Stats bar */}
      <section className="landing-stats-bar">
        {[
          { num: "96.6%", labelKey: "login.tokenReduction" as const },
          { num: t("login.oneCall"), labelKey: "login.vsReads" as const },
          { num: "$0.006", labelKey: "login.vsCost" as const },
        ].map((s) => (
          <div key={s.labelKey} className="ls-stat">
            <div className="ls-stat-num">{s.num}</div>
            <div className="ls-stat-label">{t(s.labelKey)}</div>
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
              <div className="lp-hero-label">{t("main.tokensSaved")}</div>
              <div className="lp-hero-num">{counter.toLocaleString("en")}</div>
              <div className="lp-hero-sub">
                {"\u2248"} <span style={{ color: "var(--green)", fontWeight: 600 }}>${dollars}</span> {t("main.inCosts")}
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
        <h2 className="landing-h2">{t("login.howItWorks")}</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="ls-num">1</div>
            <div className="ls-content">
              <h3>{t("login.step1Title")}</h3>
              <p><span className="mono">npx agentnorth init && npx agentnorth index</span></p>
              <p className="ls-desc">{t("login.step1Desc")}</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">2</div>
            <div className="ls-content">
              <h3>{t("login.step2Title")}</h3>
              <p><span className="mono">npx agentnorth setup</span></p>
              <p className="ls-desc">{t("login.step2Desc")}</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">3</div>
            <div className="ls-content">
              <h3>{t("login.step3Title")}</h3>
              <p><span className="mono">agentnorth_get_context("auth")</span></p>
              <p className="ls-desc">{t("login.step3Desc")}</p>
            </div>
          </div>
          <div className="landing-step">
            <div className="ls-num">4</div>
            <div className="ls-content">
              <h3>{t("login.step4Title")}</h3>
              <p><span className="mono">npx agentnorth sync</span></p>
              <p className="ls-desc">{t("login.step4Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="landing-section">
        <h2 className="landing-h2">{t("login.builtForTeams")}</h2>
        <div className="landing-features-grid">
          {([
            { icon: FEATURE_ICONS[0], titleKey: "login.feat1Title" as const, descKey: "login.feat1Desc" as const },
            { icon: FEATURE_ICONS[1], titleKey: "login.feat2Title" as const, descKey: "login.feat2Desc" as const },
            { icon: FEATURE_ICONS[2], titleKey: "login.feat3Title" as const, descKey: "login.feat3Desc" as const },
            { icon: FEATURE_ICONS[3], titleKey: "login.feat4Title" as const, descKey: "login.feat4Desc" as const },
            { icon: FEATURE_ICONS[4], titleKey: "login.feat5Title" as const, descKey: "login.feat5Desc" as const },
            { icon: FEATURE_ICONS[5], titleKey: "login.feat6Title" as const, descKey: "login.feat6Desc" as const },
          ]).map((f) => (
            <div key={f.titleKey} className="lf-card">
              <div className="lf-card-icon">{f.icon}</div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MCP Tools table */}
      <section className="landing-section">
        <h2 className="landing-h2">{t("login.mcpTools")}</h2>
        <div className="landing-tools-table">
          <div className="lt-tool-row header">
            <span>{t("login.tool")}</span>
            <span>{t("login.direction")}</span>
            <span>{t("login.whatItDoes")}</span>
          </div>
          {[
            { name: "list_modules", dir: "read", descKey: "login.toolListModules" as const },
            { name: "get_context", dir: "read", descKey: "login.toolGetContext" as const },
            { name: "get_schema", dir: "read", descKey: "login.toolGetSchema" as const },
            { name: "get_decisions", dir: "read", descKey: "login.toolGetDecisions" as const },
            { name: "log_decision", dir: "write", descKey: "login.toolLogDecision" as const },
            { name: "log_change", dir: "write", descKey: "login.toolLogChange" as const },
          ].map((tool) => (
            <div key={tool.name} className="lt-tool-row">
              <span className="mono">{tool.name}</span>
              <span className={"lt-dir " + tool.dir}>{t(tool.dir === "read" ? "login.read" : "login.write")}</span>
              <span>{t(tool.descKey)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Setup snippet */}
      <section className="landing-section">
        <h2 className="landing-h2">{t("login.upAndRunning")}</h2>
        <div className="landing-terminal">
          <div className="lt-bar">
            <div className="lp-dots"><span></span><span></span><span></span></div>
            <span className="lt-title">{t("login.terminal")}</span>
          </div>
          <div className="lt-body">
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth init</div>
            <div className="lt-output">{t("login.termStep1")}</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth index</div>
            <div className="lt-output">{t("login.termStep2")}</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth setup</div>
            <div className="lt-output">{t("login.termStep3")}</div>
            <div className="lt-line"><span className="lt-prompt">$</span> npx agentnorth sync</div>
            <div className="lt-output">{t("login.termStep4")}</div>
            <div className="lt-line"><span className="lt-prompt">$</span> <span className="lt-cursor">_</span></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-final">
        <h2 className="landing-h2">{t("login.ctaTitle")}<br/>{t("login.ctaSubtitle")}</h2>
        <p className="landing-sub" style={{ maxWidth: 520, margin: "0 auto 32px" }}>
          {t("login.ctaDesc")}
        </p>
        <div className="landing-ctas">
          <button className="landing-cta" onClick={() => { window.location.href = "/api/auth/signin"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            {t("login.signIn")}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>{t("login.footer")}</span>
        <span>&middot;</span>
        <a href="https://github.com/Santy1422/AgentNorth" target="_blank" rel="noreferrer">GitHub</a>
        <span>&middot;</span>
        <a href="https://npmjs.com/package/agentnorth" target="_blank" rel="noreferrer">npm</a>
      </footer>
    </div>
  );
}
