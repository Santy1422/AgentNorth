import { describe, it, expect } from "vitest";
import { classifyFile } from "../../src/core/indexer.js";

/**
 * Test classifyFile directly with minimal ParsedFile-like objects.
 * No need to run the full parser — we only need path + exports.
 */
function makeParsed(path: string, exports: string[] = []) {
  return { path, exports, imports: [], functions: [], classes: [], loc: 10, complexity: 1, jsdoc: [] };
}

describe("classifyFile", () => {
  it("classifies page.tsx as 'page'", () => {
    expect(classifyFile(makeParsed("src/app/page.tsx", ["default"]))).toBe("page");
  });

  it("classifies page.ts as 'page'", () => {
    expect(classifyFile(makeParsed("src/app/page.ts"))).toBe("page");
  });

  it("classifies layout.tsx as 'page'", () => {
    expect(classifyFile(makeParsed("src/app/layout.tsx"))).toBe("page");
  });

  it("classifies /pages/ directory as 'page'", () => {
    expect(classifyFile(makeParsed("src/pages/index.ts"))).toBe("page");
  });

  it("classifies route.ts in /api/ as 'route'", () => {
    expect(classifyFile(makeParsed("src/app/api/users/route.ts", ["GET", "POST"]))).toBe("route");
  });

  it("classifies route.tsx in /api/ as 'route'", () => {
    expect(classifyFile(makeParsed("src/app/api/v1/route.tsx", ["GET"]))).toBe("route");
  });

  it("classifies .tsx with PascalCase in /components/ as 'component'", () => {
    expect(classifyFile(makeParsed("src/components/Button.tsx", ["Button"]))).toBe("component");
  });

  it("classifies .tsx with PascalCase outside /components/ as 'component'", () => {
    expect(classifyFile(makeParsed("src/ui/Card.tsx", ["Card"]))).toBe("component");
  });

  it("classifies /hooks/ files as 'hook'", () => {
    expect(classifyFile(makeParsed("src/hooks/useAuth.ts", ["useAuth"]))).toBe("hook");
  });

  it("classifies file starting with 'use' as 'hook'", () => {
    expect(classifyFile(makeParsed("src/stuff/useTheme.ts", ["useTheme"]))).toBe("hook");
  });

  it("classifies /models/ files as 'model'", () => {
    expect(classifyFile(makeParsed("src/models/account.ts", ["Account"]))).toBe("model");
  });

  it("classifies /schemas/ files as 'model'", () => {
    expect(classifyFile(makeParsed("src/schemas/config.ts", ["schema"]))).toBe("model");
  });

  it("classifies .schema.ts as 'model'", () => {
    expect(classifyFile(makeParsed("src/db/account.schema.ts", ["AccountSchema"]))).toBe("model");
  });

  it("classifies /lib/ files as 'lib'", () => {
    expect(classifyFile(makeParsed("src/lib/utils.ts", ["slugify"]))).toBe("lib");
  });

  it("classifies /utils/ files as 'lib'", () => {
    expect(classifyFile(makeParsed("src/utils/format.ts", ["format"]))).toBe("lib");
  });

  it("classifies /helpers/ files as 'lib'", () => {
    expect(classifyFile(makeParsed("src/helpers/date.ts", ["formatDate"]))).toBe("lib");
  });

  it("classifies /core/ files as 'lib'", () => {
    expect(classifyFile(makeParsed("src/core/engine.ts", ["run"]))).toBe("lib");
  });

  it("classifies /cli/ files as 'lib'", () => {
    expect(classifyFile(makeParsed("src/cli/commands/init.ts", ["initCommand"]))).toBe("lib");
  });

  it("classifies /server/ files as 'lib'", () => {
    expect(classifyFile(makeParsed("src/server/index.ts", ["start"]))).toBe("lib");
  });

  it("classifies .test.ts as 'test'", () => {
    expect(classifyFile(makeParsed("src/foo.test.ts"))).toBe("test");
  });

  it("classifies .spec.ts as 'test'", () => {
    expect(classifyFile(makeParsed("src/bar.spec.ts"))).toBe("test");
  });

  it("classifies __tests__/ as 'test'", () => {
    expect(classifyFile(makeParsed("src/__tests__/utils.ts"))).toBe("test");
  });

  it("classifies .config.ts as 'config'", () => {
    expect(classifyFile(makeParsed("vitest.config.ts"))).toBe("config");
  });

  it("classifies .config.js as 'config'", () => {
    expect(classifyFile(makeParsed("next.config.js"))).toBe("config");
  });

  it("classifies .sql as 'schema'", () => {
    expect(classifyFile(makeParsed("migrations/001.sql"))).toBe("schema");
  });

  it("classifies .prisma as 'schema'", () => {
    expect(classifyFile(makeParsed("prisma/schema.prisma"))).toBe("schema");
  });

  it("classifies unknown files as 'unknown'", () => {
    expect(classifyFile(makeParsed("src/misc/data.ts", ["x"]))).toBe("unknown");
  });

  it("test files take priority over other patterns", () => {
    // Even if in /models/, .test.ts wins
    expect(classifyFile(makeParsed("src/models/user.test.ts"))).toBe("test");
  });
});
