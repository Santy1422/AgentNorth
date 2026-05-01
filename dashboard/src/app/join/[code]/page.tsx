"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [orgName, setOrgName] = useState("");

  async function handleJoin() {
    setStatus("joining");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code }),
      });
      const data = await res.json();
      if (data.ok) {
        setOrgName(data.org_name);
        setStatus("done");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 18, borderRadius: 12 }}>AN</div>
        </div>
        <h1 className="login-title">Join Team</h1>

        {status === "idle" && (
          <>
            <p className="login-subtitle">
              You've been invited to join a team on AgentNorth.
            </p>
            <button className="login-btn" onClick={handleJoin}>
              Accept Invite
            </button>
            <p className="login-note" style={{ marginTop: 12 }}>
              You need to be signed in with GitHub first.{" "}
              <a href="/api/auth/signin" style={{ color: "var(--accent)" }}>Sign in</a>
            </p>
          </>
        )}

        {status === "joining" && (
          <p className="login-subtitle">Joining team...</p>
        )}

        {status === "done" && (
          <>
            <p className="login-subtitle">
              You joined <strong>{orgName}</strong>! Redirecting...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="login-subtitle" style={{ color: "var(--red)" }}>
              Invalid invite code, or you're not signed in.
            </p>
            <button className="login-btn" onClick={() => window.location.href = "/api/auth/signin"}>
              Sign in with GitHub first
            </button>
          </>
        )}
      </div>
    </div>
  );
}
