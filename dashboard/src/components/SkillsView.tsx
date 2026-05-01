"use client";

export function SkillsView() {
  return (
    <section>
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Skills</h2>
        <span className="meta">proximamente</span>
      </div>
      <div className="empty-state-lg">
        <div className="empty-icon">&#x2699;</div>
        <div className="empty-title">Skills marketplace coming soon</div>
        <div className="empty-desc">
          Los skills permiten que agentes y devs reusen flujos de trabajo del equipo.
          Esta seccion mostrara los skills instalados y disponibles.
        </div>
      </div>
    </section>
  );
}
