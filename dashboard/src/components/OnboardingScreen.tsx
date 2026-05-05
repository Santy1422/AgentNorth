"use client";

import { useState, useEffect } from "react";
import { useT } from "@/i18n/provider";

export function OnboardingScreen() {
  const { t } = useT();
  const [keys, setKeys] = useState<{ org_key: string; dev_key: string } | null>(null);
  const [team, setTeam] = useState<{
    org: { name?: string; invite_code?: string; plan?: string };
    members: { _id: string; name: string; role: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [joinedOrg, setJoinedOrg] = useState("");

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(setTeam).catch(() => {});
  }, []);

  async function handleJoinTeam() {
    if (!joinCode.trim()) return;
    setJoinStatus("joining");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: joinCode.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setJoinedOrg(data.org_name);
        setJoinStatus("done");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setJoinStatus("error");
      }
    } catch {
      setJoinStatus("error");
    }
  }

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
            <h1 className="onboard-title">{t("onboarding.welcome")}</h1>
            <p className="onboard-sub">{team?.org?.name || t("onboarding.subtitle")}</p>
          </div>
        </div>

        
        {/* Join existing team option */}
        <div className="onboard-join-section">
          <div className="onboard-join-divider">
            <span>{t("onboarding.orJoinTeam")}</span>
          </div>
          <div className="onboard-join-form">
            <p className="os-desc">{t("onboarding.joinDesc")}</p>
            <div className="os-join-row">
              <input
                type="text"
                className="os-join-input"
                placeholder={t("onboarding.inviteCodePlaceholder")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinTeam()}
              />
              <button
                className="onboard-btn small"
                onClick={handleJoinTeam}
                disabled={joinStatus === "joining" || !joinCode.trim()}
              >
                {joinStatus === "joining" ? "..." : t("onboarding.joinBtn")}
              </button>
            </div>
            {joinStatus === "done" && (
              <div className="os-join-success">Joined <strong>{joinedOrg}</strong>! Reloading...</div>
            )}
            {joinStatus === "error" && (
              <div className="os-join-error">{t("onboarding.joinError")}</div>
            )}
          </div>
        </div>

{/* Step 1 */}
        <div className="onboard-step">
          <div className="os-num">1</div>
          <div className="os-body">
            <div className="os-title">{t("onboarding.step1Title")}</div>
            <div className="os-code">
              <code>npx agentnorth init</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth init", "init")}>
                {copied === "init" ? t("onboarding.copied") : t("onboarding.copy")}
              </button>
            </div>
            <div className="os-desc">
              {t("onboarding.step1Desc")}
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="onboard-step">
          <div className="os-num">2</div>
          <div className="os-body">
            <div className="os-title">{t("onboarding.step2Title")}</div>
            <div className="os-code">
              <code>npx agentnorth index</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth index", "index")}>
                {copied === "index" ? t("onboarding.copied") : t("onboarding.copy")}
              </button>
            </div>
            <div className="os-desc">
              {t("onboarding.step2Desc")}
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="onboard-step">
          <div className="os-num">3</div>
          <div className="os-body">
            <div className="os-title">{t("onboarding.step3Title")}</div>
            <div className="os-code">
              <code>npx agentnorth setup</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth setup", "setup")}>
                {copied === "setup" ? t("onboarding.copied") : t("onboarding.copy")}
              </button>
            </div>
            <div className="os-desc">
              {t("onboarding.step3Desc")}
            </div>
          </div>
        </div>

        {/* Step 4 — API Keys */}
        <div className="onboard-step">
          <div className="os-num">4</div>
          <div className="os-body">
            <div className="os-title">{t("onboarding.step4Title")}</div>
            <div className="os-desc" style={{ marginBottom: 12 }}>
              {t("onboarding.step4Desc")}
            </div>

            {!keys ? (
              <button className="onboard-btn" onClick={generateKeys} disabled={loading}>
                {loading ? t("onboarding.generating") : t("onboarding.generateKeys")}
              </button>
            ) : (
              <div className="os-keys">
                <div className="os-key-row">
                  <span className="os-key-label">AGENTNORTH_ORG_KEY</span>
                  <code className="os-key-value">{keys.org_key}</code>
                  <button className="os-copy" onClick={() => copy(keys.org_key, "org")}>
                    {copied === "org" ? t("onboarding.copied") : t("onboarding.copy")}
                  </button>
                </div>
                <div className="os-key-row">
                  <span className="os-key-label">AGENTNORTH_DEV_KEY</span>
                  <code className="os-key-value">{keys.dev_key}</code>
                  <button className="os-copy" onClick={() => copy(keys.dev_key, "dev")}>
                    {copied === "dev" ? t("onboarding.copied") : t("onboarding.copy")}
                  </button>
                </div>
                <div className="os-key-row">
                  <span className="os-key-label">AGENTNORTH_API_URL</span>
                  <code className="os-key-value">{window.location.origin}</code>
                  <button className="os-copy" onClick={() => copy(window.location.origin, "url")}>
                    {copied === "url" ? t("onboarding.copied") : t("onboarding.copy")}
                  </button>
                </div>
                <div className="os-key-warn">
                  {t("onboarding.saveKeys")}
                </div>
                <div className="os-desc" style={{ marginTop: 12 }}>
                  {t("onboarding.addKeys")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 5 */}
        <div className="onboard-step">
          <div className="os-num">5</div>
          <div className="os-body">
            <div className="os-title">{t("onboarding.step5Title")}</div>
            <div className="os-code">
              <code>npx agentnorth sync</code>
              <button className="os-copy" onClick={() => copy("npx agentnorth sync", "sync")}>
                {copied === "sync" ? t("onboarding.copied") : t("onboarding.copy")}
              </button>
            </div>
            <div className="os-desc">
              {t("onboarding.step5Desc")}
            </div>
          </div>
        </div>

        {/* Invite team */}
        {inviteUrl && (
          <div className="onboard-step">
            <div className="os-num" style={{ background: "var(--violet)" }}>+</div>
            <div className="os-body">
              <div className="os-title">{t("onboarding.step6Title")}</div>
              <div className="os-desc" style={{ marginBottom: 10 }}>
                {t("onboarding.step6Desc")}
              </div>
              <div className="os-code">
                <code>{inviteUrl}</code>
                <button className="os-copy" onClick={() => copy(inviteUrl, "invite")}>
                  {copied === "invite" ? t("onboarding.copied") : t("onboarding.copy")}
                </button>
              </div>
              {team && team.members.length > 1 && (
                <div className="os-team-list">
                  {team.members.map((m) => (
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
            {t("onboarding.showDashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
