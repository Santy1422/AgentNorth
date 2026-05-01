"use client";

import { useState, useEffect } from "react";
import { SESSIONS, FEED_SEED, FEED_TICKER, SKILLS, personById } from "@/data/mock";
import { Header } from "@/components/Header";
import { MainView } from "@/components/MainView";
import { MapView } from "@/components/MapView";
import { CoverageView } from "@/components/CoverageView";
import { RisksView } from "@/components/RisksView";
import { SkillsView } from "@/components/SkillsView";

export type View = "main" | "map" | "coverage" | "risks" | "skills";

export default function Home() {
  const [view, setView] = useState<View>("main");
  const [feedRows, setFeedRows] = useState(FEED_SEED.slice(0, 6));
  const [savedTokens, setSavedTokens] = useState(284142);

  // Live ticker — every 5s push event + bump counter
  useEffect(() => {
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
  }, []);

  return (
    <div className="simple-app">
      <Header view={view} setView={setView} />
      <main className="simple-main">
        {view === "main" && <MainView feedRows={feedRows} savedTokens={savedTokens} />}
        {view === "map" && <MapView />}
        {view === "coverage" && <CoverageView />}
        {view === "risks" && <RisksView />}
        {view === "skills" && <SkillsView />}
      </main>
    </div>
  );
}
