"use client";

const PLANNED_SKILLS = [
  { name: "Auto-Review", desc: "Revisa PRs automaticamente con contexto del proyecto", status: "planned" },
  { name: "Migration Assistant", desc: "Guia migraciones de dependencias paso a paso", status: "planned" },
  { name: "Test Generator", desc: "Genera tests unitarios para modulos sin cobertura", status: "planned" },
  { name: "Security Scanner", desc: "Escanea codigo por vulnerabilidades OWASP", status: "planned" },
  { name: "Refactor Planner", desc: "Sugiere refactors basado en complejidad y deuda tecnica", status: "planned" },
  { name: "Onboarding Bot", desc: "Responde preguntas de nuevos devs sobre el codebase", status: "planned" },
];

export function SkillsView() {
  return (
    <section>
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Skills Marketplace</h2>
        <span className="meta">proximamente</span>
      </div>
      <div className="card-simple" style={{ marginBottom: 16, borderLeft: "3px solid var(--accent)" }}>
        <div style={{ padding: "4px 0", fontSize: 12, color: "var(--text-2)" }}>
          Los skills son flujos de trabajo reutilizables que agentes y devs pueden ejecutar con un solo comando.
          Se instalan como plugins y tienen acceso al contexto completo del proyecto.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {PLANNED_SKILLS.map((skill) => (
          <div key={skill.name} className="card-simple" style={{ opacity: 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{skill.name}</span>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "var(--bg-3)", color: "var(--text-4)" }}>
                pronto
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{skill.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
