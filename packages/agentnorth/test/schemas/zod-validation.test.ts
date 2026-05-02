import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  ModuleConfigSchema,
  EnforcementConfigSchema,
  AgentNorthConfigSchema,
} from "../../src/schemas/config.js";
import {
  GetContextInputSchema,
  GetSchemaInputSchema,
  GetDecisionsInputSchema,
} from "../../src/schemas/bundle.js";
import {
  LogDecisionInputSchema,
  LogChangeInputSchema,
} from "../../src/schemas/decision.js";

// ─── ModuleConfigSchema ────────────────────────────────────────────

describe("ModuleConfigSchema", () => {
  it("accepts valid input with required fields only", () => {
    const result = ModuleConfigSchema.parse({ paths: ["src/auth/"] });
    expect(result.paths).toEqual(["src/auth/"]);
    expect(result.description).toBeUndefined();
  });

  it("accepts valid input with all fields", () => {
    const result = ModuleConfigSchema.parse({
      paths: ["src/auth/"],
      description: "Auth module",
      schema_source: "prisma/schema.prisma",
      depends_on: ["core"],
    });
    expect(result.description).toBe("Auth module");
    expect(result.schema_source).toBe("prisma/schema.prisma");
    expect(result.depends_on).toEqual(["core"]);
  });

  it("rejects empty paths array", () => {
    expect(() => ModuleConfigSchema.parse({ paths: [] })).toThrow(ZodError);
  });

  it("rejects missing paths", () => {
    expect(() => ModuleConfigSchema.parse({})).toThrow(ZodError);
  });

  it("rejects non-string in paths", () => {
    expect(() => ModuleConfigSchema.parse({ paths: [123] })).toThrow(ZodError);
  });
});

// ─── EnforcementConfigSchema ───────────────────────────────────────

describe("EnforcementConfigSchema", () => {
  it("uses defaults when no fields provided", () => {
    const result = EnforcementConfigSchema.parse({});
    expect(result.level).toBe("soft");
    expect(result.track_sessions).toBe(true);
    expect(result.require_log_change).toBe(true);
    expect(result.require_log_decision).toBe(false);
  });

  it("accepts valid level values", () => {
    for (const level of ["soft", "strict", "audit"] as const) {
      const result = EnforcementConfigSchema.parse({ level });
      expect(result.level).toBe(level);
    }
  });

  it("rejects invalid level value", () => {
    expect(() => EnforcementConfigSchema.parse({ level: "none" })).toThrow(ZodError);
  });

  it("accepts boolean overrides", () => {
    const result = EnforcementConfigSchema.parse({
      track_sessions: false,
      require_log_change: false,
      require_log_decision: true,
    });
    expect(result.track_sessions).toBe(false);
    expect(result.require_log_change).toBe(false);
    expect(result.require_log_decision).toBe(true);
  });
});

// ─── AgentNorthConfigSchema ────────────────────────────────────────

describe("AgentNorthConfigSchema", () => {
  const validConfig = {
    version: 1,
    project: { name: "my-project" },
    modules: {
      auth: { paths: ["src/auth/"] },
    },
  };

  it("accepts a minimal valid config", () => {
    const result = AgentNorthConfigSchema.parse(validConfig);
    expect(result.version).toBe(1);
    expect(result.project.name).toBe("my-project");
    expect(Object.keys(result.modules)).toEqual(["auth"]);
  });

  it("accepts full config with all optional fields", () => {
    const result = AgentNorthConfigSchema.parse({
      ...validConfig,
      project: { name: "my-project", framework: "next.js" },
      ignore: ["node_modules/", "dist/"],
      conventions: { naming: "camelCase" },
      enforcement: { level: "strict" },
    });
    expect(result.project.framework).toBe("next.js");
    expect(result.ignore).toEqual(["node_modules/", "dist/"]);
    expect(result.conventions).toEqual({ naming: "camelCase" });
    expect(result.enforcement?.level).toBe("strict");
  });

  it("rejects missing version", () => {
    expect(() =>
      AgentNorthConfigSchema.parse({
        project: { name: "p" },
        modules: { a: { paths: ["x/"] } },
      }),
    ).toThrow(ZodError);
  });

  it("rejects version less than 1", () => {
    expect(() =>
      AgentNorthConfigSchema.parse({
        version: 0,
        project: { name: "p" },
        modules: { a: { paths: ["x/"] } },
      }),
    ).toThrow(ZodError);
  });

  it("rejects non-integer version", () => {
    expect(() =>
      AgentNorthConfigSchema.parse({
        version: 1.5,
        project: { name: "p" },
        modules: { a: { paths: ["x/"] } },
      }),
    ).toThrow(ZodError);
  });

  it("rejects empty project name", () => {
    expect(() =>
      AgentNorthConfigSchema.parse({
        version: 1,
        project: { name: "" },
        modules: { a: { paths: ["x/"] } },
      }),
    ).toThrow(ZodError);
  });

  it("rejects missing modules", () => {
    expect(() =>
      AgentNorthConfigSchema.parse({
        version: 1,
        project: { name: "p" },
      }),
    ).toThrow(ZodError);
  });

  it("strips extra fields (passthrough not enabled)", () => {
    const result = AgentNorthConfigSchema.parse({
      ...validConfig,
      extraField: "should be stripped",
    });
    expect((result as Record<string, unknown>).extraField).toBeUndefined();
  });
});

// ─── GetContextInputSchema ─────────────────────────────────────────

describe("GetContextInputSchema", () => {
  it("accepts valid module name", () => {
    const result = GetContextInputSchema.parse({ module: "auth" });
    expect(result.module).toBe("auth");
  });

  it("rejects empty module name", () => {
    expect(() => GetContextInputSchema.parse({ module: "" })).toThrow(ZodError);
  });

  it("rejects missing module", () => {
    expect(() => GetContextInputSchema.parse({})).toThrow(ZodError);
  });
});

// ─── GetSchemaInputSchema ──────────────────────────────────────────

describe("GetSchemaInputSchema", () => {
  it("accepts valid module name", () => {
    const result = GetSchemaInputSchema.parse({ module: "billing" });
    expect(result.module).toBe("billing");
  });

  it("rejects empty string", () => {
    expect(() => GetSchemaInputSchema.parse({ module: "" })).toThrow(ZodError);
  });
});

// ─── GetDecisionsInputSchema ───────────────────────────────────────

describe("GetDecisionsInputSchema", () => {
  it("accepts module as optional", () => {
    const result = GetDecisionsInputSchema.parse({});
    expect(result.module).toBeUndefined();
  });

  it("accepts with module specified", () => {
    const result = GetDecisionsInputSchema.parse({ module: "core" });
    expect(result.module).toBe("core");
  });
});

// ─── LogDecisionInputSchema ────────────────────────────────────────

describe("LogDecisionInputSchema", () => {
  const valid = {
    module: "auth",
    title: "Use JWT",
    context: "Need stateless auth",
    decision: "Adopt JWT with RS256",
  };

  it("accepts valid input", () => {
    const result = LogDecisionInputSchema.parse(valid);
    expect(result.module).toBe("auth");
    expect(result.title).toBe("Use JWT");
  });

  it("rejects empty module", () => {
    expect(() => LogDecisionInputSchema.parse({ ...valid, module: "" })).toThrow(ZodError);
  });

  it("rejects empty title", () => {
    expect(() => LogDecisionInputSchema.parse({ ...valid, title: "" })).toThrow(ZodError);
  });

  it("rejects empty context", () => {
    expect(() => LogDecisionInputSchema.parse({ ...valid, context: "" })).toThrow(ZodError);
  });

  it("rejects empty decision", () => {
    expect(() => LogDecisionInputSchema.parse({ ...valid, decision: "" })).toThrow(ZodError);
  });

  it("rejects missing required fields", () => {
    expect(() => LogDecisionInputSchema.parse({ module: "auth" })).toThrow(ZodError);
    expect(() => LogDecisionInputSchema.parse({})).toThrow(ZodError);
  });
});

// ─── LogChangeInputSchema ──────────────────────────────────────────

describe("LogChangeInputSchema", () => {
  const valid = {
    module: "auth",
    summary: "Added rate limiting",
    files_changed: ["src/auth/middleware.ts"],
  };

  it("accepts valid input with required fields only", () => {
    const result = LogChangeInputSchema.parse(valid);
    expect(result.module).toBe("auth");
    expect(result.summary).toBe("Added rate limiting");
    expect(result.files_changed).toEqual(["src/auth/middleware.ts"]);
    expect(result.breaking).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("accepts valid input with all fields", () => {
    const result = LogChangeInputSchema.parse({
      ...valid,
      breaking: true,
      notes: "Removed old endpoint",
    });
    expect(result.breaking).toBe(true);
    expect(result.notes).toBe("Removed old endpoint");
  });

  it("rejects empty module", () => {
    expect(() => LogChangeInputSchema.parse({ ...valid, module: "" })).toThrow(ZodError);
  });

  it("rejects empty summary", () => {
    expect(() => LogChangeInputSchema.parse({ ...valid, summary: "" })).toThrow(ZodError);
  });

  it("rejects empty files_changed array", () => {
    expect(() =>
      LogChangeInputSchema.parse({ ...valid, files_changed: [] }),
    ).toThrow(ZodError);
  });

  it("rejects missing files_changed", () => {
    expect(() =>
      LogChangeInputSchema.parse({ module: "auth", summary: "x" }),
    ).toThrow(ZodError);
  });

  it("rejects non-boolean breaking", () => {
    expect(() =>
      LogChangeInputSchema.parse({ ...valid, breaking: "yes" }),
    ).toThrow(ZodError);
  });
});
