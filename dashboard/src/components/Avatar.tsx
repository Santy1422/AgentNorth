"use client";

import type { Person } from "@/data/mock";

export function Avatar({ p, size = "" }: { p: Person | undefined; size?: string }) {
  if (!p) return null;
  const cls = "avatar" + (size ? " " + size : "");
  return (
    <div className={cls} style={{ background: p.color }}>
      {p.initials}
    </div>
  );
}

export function ClaudeAvatar({ size = "" }: { size?: string }) {
  return (
    <div className={"avatar claude" + (size ? " " + size : "")}>C</div>
  );
}
