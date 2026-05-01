"use client";

import { useState, useEffect } from "react";

export function OnboardingScreen() {
  const [keys, setKeys] = useState<{ org_key: string; dev_key: string } | null>(null);
  const [team, setTeam] = useState<{ org: any; members: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(setTeam).catch(() => {});
  }, []);

  async function generateKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      const data = await res.json();
      if (data.org_key) setKeys(data);
    } catch {}
    setLoading(false);
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const inviteUrl = team?.org?.invite_code
    ? `${window.location.origin}/join/${team.org.invite_code}`
    : "";

  return (
    <div className="onboard-screen">
      <div className="onboard-card">
        <div className="onboard-header">
          <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 15, borderRadius: 10 }}>AN</div>
          <div>
            <h1 className="onboard-title">Welcome to AgentNorth</h1>
            <p className="onboard-sub">{team?.org?.name || "Set up your first project in 2 minutes"}</p>
          </div>
        </div>

        {/* Step 1 */}
        <div className="onboard-step">
          <div className="os-num">1</div>
          <div className="os-body">
            <div className="os-title">Install AgentNorth in your repo</div>
            <div className="os-code">
              <code>npx agentnorth init</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth init", "init")}>
                {copied === "init" ? "copied!" : "copy"}
              </button>
            </div>
            <div className="os-desc">
              Scans your project and creates <span className="mono">.agentnorth/config.yaml</span> with your modules.
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="onboard-step">
          <div className="os-num">2</div>
          <div className="os-body">
            <div className="os-title">Index your codebase</div>
            <div className="os-code">
              <code>npx agentnorth index</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth index", "index")}>
                {copied === "index" ? "copied!" : "copy"}
              </button>
            </div>
            <div className="os-desc">
              Generates context bundles — files, exports, schemas, dependencies per module.
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="onboard-step">
          <div className="os-num">3</div>
          <div className="os-body">
            <div className="os-title">Set up Claude Code hooks</div>
            <div className="os-code">
              <code>npx agentnorth setup</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth setup", "setup")}>
                {copied === "setup" ? "copied!" : "copy"}
              </button>
            </div>
            <div className="os-desc">
              Creates <span className="mono">.claude/</span> hooks + <span className="mono">CLAUDE.md</span> so agents use AgentNorth automatically.
            </div>
          </div>
        </div>

        {/* Step 4 — API Keys */}
        <div className="onboard-step">
          <div className="os-num">4</div>
          <div className="os-body">
            <div className="os-title">Connect to the dashboard</div>
            <div className="os-desc" style={{ marginBottom: 12 }}>
              Generate API keys so your MCP server sends data here in real-time.
            </div>

            {!keys ? (
              <button className="onboard-btn" onClick={generateKeys} disabled={loading}>
                {loading ? "Generating..." : "Generate API Keys"}
              </button>
            ) : (
              <div className="os-keys">
                <div className="os-key-row">
                  <span className="os-key-label">AGENTNORTH_ORG_KEY</span>
                  <code className="os-key-value">{keys.org_key}</code>
                  <button className="os-copy" onClick={() => copy(keys.org_key, "org")}>
                    {copied === "org" ? "copied!" : "copy"}
                  </button>
                </div>
                <div className="os-key-row">
                  <span className="os-key-label">AGENTNORTH_DEV_KEY</span>
                  <code className="os-key-value">{keys.dev_key}</code>
                  <button className="os-copy" onClick={() => copy(keys.dev_key, "dev")}>
                    {copied === "dev" ? "copied!" : "copy"}
                  </button>
                </div>
                <div className="os-key-row">
                  <span className="os-key-label">AGENTNORTH_API_URL</span>
                  <code className="os-key-value">{window.location.origin}</code>
                  <button className="os-copy" onClick={() => copy(window.location.origin, "url")}>
                    {copied === "url" ? "copied!" : "copy"}
                  </button>
                </div>
                <div className="os-key-warn">
                  Save these keys now — they won't be shown again.
                </div>
                <div className="os-desc" style={{ marginTop: 12 }}>
                  Add them to <span className="mono">.claude/settings.json</span> → <span className="mono">mcpServers.agentnorth.env</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 5 */}
        <div className="onboard-step">
          <div className="os-num">5</div>
          <div className="os-body">
            <div className="os-title">Sync your project</div>
            <div className="os-code">
              <code>npx agentnorth sync</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth sync", "sync")}>
                {copied === "sync" ? "copied!" : "copy"}
              </button>
            </div>
            <div className="os-desc">
              Pushes modules + decisions to the dashboard. After this, MCP does it automatically.
            </div>
          </div>
        </div>

        {/* Invite team */}
        {inviteUrl && (
          <div className="onboard-step">
            <div className="os-num" style={{ background: "var(--violet)" }}>+</div>
            <div className="os-body">
              <div className="os-title">Invite your team</div>
              <div className="os-desc" style={{ marginBottom: 10 }}>
                Share this link with teammates. They sign in with GitHub and join your org automatically.
              </div>
              <div className="os-code">
                <code>{inviteUrl}</code>
                <button className="os-copy" onClick={() => copy(inviteUrl, "invite")}>
                  {copied === "invite" ? "copied!" : "copy"}
                </button>
              </div>
              {team && team.members.length > 1 && (
                <div className="os-team-list">
                  {team.members.map((m: any) => (
                    <div key={m._id} className="os-team-member">
                      <span className="os-team-name">{m.name}</span>
                      <span className="os-team-role">{m.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="onboard-footer">
          <button className="onboard-btn secondary" onClick={() => window.location.reload()}>
            I've synced — show dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
