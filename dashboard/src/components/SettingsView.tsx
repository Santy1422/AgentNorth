"use client";

import { useState, useEffect, useCallback } from "react";
import { useT } from "@/i18n/provider";

interface Member {
  _id: string;
  name: string;
  email: string;
  role: string;
  github_id?: string;
  last_active_at?: string;
  created_at: string;
}

interface OrgInfo {
  name: string;
  invite_code: string;
  plan: string;
}

type Tab = "general" | "team" | "keys";

export function SettingsView() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("general");
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Keys state
  const [orgKeyPrefix, setOrgKeyPrefix] = useState<string | null>(null);
  const [devKeyPrefix, setDevKeyPrefix] = useState<string | null>(null);
  const [newKeys, setNewKeys] = useState<{ org_key: string; dev_key: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (!res.ok) return;
      const json = await res.json();
      setOrg(json.org);
      setMembers(json.members);
    } catch { /* ignore */ }
  }, []);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) return;
      const json = await res.json();
      setOrgKeyPrefix(json.org_key_prefix);
      setDevKeyPrefix(json.dev_key_prefix);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchTeam(), fetchKeys()]).then(() => setLoading(false));
  }, [fetchTeam, fetchKeys]);

  const copyInviteLink = () => {
    if (!org?.invite_code) return;
    const link = window.location.origin + "/join/" + org.invite_code;
    navigator.clipboard.writeText(link);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setNewKeys({ org_key: json.org_key, dev_key: json.dev_key });
      setOrgKeyPrefix(json.org_key.slice(0, 12) + "...");
      setDevKeyPrefix(json.dev_key.slice(0, 12) + "...");
    } catch { /* ignore */ }
    setRegenerating(false);
    setConfirmRegen(false);
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  if (loading) {
    return (
      <section className="view-section">
        <div className="settings-loading">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </section>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "general", label: t("settings.general"), icon: "⚙" },
    { id: "team", label: t("settings.team"), icon: "👥" },
    { id: "keys", label: t("settings.apiKeys"), icon: "🔑" },
  ];

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const relativeTime = (d: string) => {
    const now = Date.now();
    const then = new Date(d).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + "d ago";
    return formatDate(d);
  };

  return (
    <section className="view-section">
      <div className="view-header">
        <div>
          <h2 className="view-title">{t("settings.title")}</h2>
          <p className="view-sub">{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              className={"settings-tab" + (tab === tb.id ? " active" : "")}
              onClick={() => setTab(tb.id)}
            >
              <span className="settings-tab-icon">{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </aside>

        <div className="settings-content">
          {/* General Tab */}
          {tab === "general" && (
            <div className="settings-panel">
              <h3 className="settings-section-title">{t("settings.orgProfile")}</h3>
              <div className="settings-card">
                <div className="settings-field">
                  <label className="settings-label">{t("settings.orgName")}</label>
                  <div className="settings-value">{org?.name || "—"}</div>
                </div>
                <div className="settings-field">
                  <label className="settings-label">{t("settings.plan")}</label>
                  <div className="settings-value">
                    <span className="settings-plan-badge">{org?.plan || "free"}</span>
                  </div>
                </div>
                <div className="settings-field">
                  <label className="settings-label">{t("settings.members")}</label>
                  <div className="settings-value">{members.length} {t("settings.membersCount")}</div>
                </div>
              </div>

              <h3 className="settings-section-title" style={{ marginTop: 32 }}>{t("settings.inviteLink")}</h3>
              <div className="settings-card">
                <p className="settings-hint">{t("settings.inviteDesc")}</p>
                {org?.invite_code && (
                  <div className="settings-invite-row">
                    <code className="settings-invite-code">
                      {window.location.origin}/join/{org.invite_code}
                    </code>
                    <button className="settings-copy-btn" onClick={copyInviteLink}>
                      {copiedInvite ? "✓" : t("settings.copy")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team Tab */}
          {tab === "team" && (
            <div className="settings-panel">
              <div className="settings-team-header">
                <h3 className="settings-section-title">{t("settings.teamMembers")}</h3>
                <span className="settings-member-count">{members.length}</span>
              </div>
              <div className="settings-card">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>{t("settings.name")}</th>
                      <th>{t("settings.role")}</th>
                      <th>{t("settings.joined")}</th>
                      <th>{t("settings.lastActive")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m._id}>
                        <td>
                          <div className="settings-member-info">
                            <div className="settings-avatar">
                              {(m.name || m.email || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="settings-member-name">{m.name || "—"}</div>
                              <div className="settings-member-email">{m.email || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={"settings-role-badge " + (m.role || "member")}>
                            {m.role || "member"}
                          </span>
                        </td>
                        <td className="settings-date">{formatDate(m.created_at)}</td>
                        <td className="settings-date">
                          {m.last_active_at ? relativeTime(m.last_active_at) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="settings-invite-section">
                <h4>{t("settings.inviteMembers")}</h4>
                <p className="settings-hint">{t("settings.inviteMembersDesc")}</p>
                {org?.invite_code && (
                  <div className="settings-invite-row">
                    <code className="settings-invite-code">
                      {window.location.origin}/join/{org.invite_code}
                    </code>
                    <button className="settings-copy-btn" onClick={copyInviteLink}>
                      {copiedInvite ? "✓" : t("settings.copy")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {tab === "keys" && (
            <div className="settings-panel">
              <h3 className="settings-section-title">{t("settings.apiKeysTitle")}</h3>
              <p className="settings-hint">{t("settings.apiKeysDesc")}</p>

              <div className="settings-card">
                <div className="settings-key-row">
                  <div>
                    <label className="settings-label">AGENTNORTH_ORG_KEY</label>
                    <code className="settings-key-prefix">{orgKeyPrefix || "—"}</code>
                  </div>
                </div>
                <div className="settings-key-row">
                  <div>
                    <label className="settings-label">AGENTNORTH_DEV_KEY</label>
                    <code className="settings-key-prefix">{devKeyPrefix || "—"}</code>
                  </div>
                </div>
              </div>

              {newKeys && (
                <div className="settings-new-keys">
                  <div className="settings-warning-banner">
                    ⚠ {t("settings.saveKeysWarning")}
                  </div>
                  <div className="settings-key-display">
                    <div className="settings-key-item">
                      <label>AGENTNORTH_ORG_KEY</label>
                      <div className="settings-key-copy-row">
                        <code>{newKeys.org_key}</code>
                        <button className="settings-copy-btn" onClick={() => copyKey(newKeys.org_key)}>
                          {t("settings.copy")}
                        </button>
                      </div>
                    </div>
                    <div className="settings-key-item">
                      <label>AGENTNORTH_DEV_KEY</label>
                      <div className="settings-key-copy-row">
                        <code>{newKeys.dev_key}</code>
                        <button className="settings-copy-btn" onClick={() => copyKey(newKeys.dev_key)}>
                          {t("settings.copy")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="settings-danger-zone">
                <h4>{t("settings.dangerZone")}</h4>
                <p className="settings-hint">{t("settings.regenDesc")}</p>
                <button
                  className={"settings-danger-btn" + (confirmRegen ? " confirm" : "")}
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating
                    ? t("settings.regenerating")
                    : confirmRegen
                      ? t("settings.confirmRegen")
                      : t("settings.regenerateKeys")}
                </button>
                {confirmRegen && !regenerating && (
                  <button className="settings-cancel-btn" onClick={() => setConfirmRegen(false)}>
                    {t("settings.cancel")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
