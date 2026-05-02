"use client";

const PLANNED_SKILLS = [
  { name: "Auto-Review", desc: "Auto-review PRs with project context", status: "planned" },
  { name: "Migration Assistant", desc: "Guide dependency migrations step by step", status: "planned" },
  { name: "Test Generator", desc: "Generate unit tests for modules without coverage", status: "planned" },
  { name: "Security Scanner", desc: "Escanea codigo por vulnerabilidades OWASP", status: "planned" },
  { name: "Refactor Planner", desc: "Suggest refactors based on complexity and tech debt", status: "planned" },
  { name: "Onboarding Bot", desc: "Responde preguntas de nuevos devs sobre el codebase", status: "planned" },
];

export function SkillsView() {
  return (
    <section>
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Skills Marketplace</h2>
        <span className="meta">coming soon</span>
      </div>
      <div className="card-simple" style={{ marginBottom: 16, borderLeft: "3px solid var(--accent)" }}>
        <div style={{ padding: "4px 0", fontSize: 12, color: "var(--text-2)" }}>
          Skills are reusable workflows that agents and devs can execute with a single command. They install as plugins with full access to the project context.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {PLANNED_SKILLS.map((skill) => (
          <div key={skill.name} className="card-simple" style={{ opacity: 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{skill.name}</span>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "var(--bg-3)", color: "var(--text-4)" }}>
                soon
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{skill.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
