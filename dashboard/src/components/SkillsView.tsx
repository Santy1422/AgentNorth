"use client";

import { SKILLS, personById } from "@/data/mock";

export function SkillsView() {
  return (
    <section>
      <div className="card-simple-head" style={{ padding: "0 0 18px" }}>
        <h2>Skills del equipo</h2>
        <span className="meta">cualquier dev (humano o agente) los reusa</span>
      </div>
      <div className="skills-grid">
        {SKILLS.map((s) => {
          const author = personById(s.author);
          return (
            <div key={s.id} className="skill-simple">
              <div className="skill-simple-head">
                <div className="skill-simple-name mono">{s.name}</div>
                {s.official && <span className="skill-tag accent">oficial</span>}
                {s.fresh && <span className="skill-tag green">nuevo</span>}
              </div>
              <div className="skill-simple-desc">{s.desc}</div>
              <div className="skill-simple-foot">
                <span className="muted">{author?.name}</span>
                <span className="muted">·</span>
                <span className="muted">{s.uses} usos</span>
                <span className="spacer"></span>
                <button className="btn-simple">Instalar</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
