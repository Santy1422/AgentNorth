import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Import models after mongo setup to avoid "models already registered" issues
// We use dynamic import to ensure clean mongoose state
const { Organization } = await import("@/models/organization");
const { Developer } = await import("@/models/developer");
const { Project } = await import("@/models/project");
const { Decision } = await import("@/models/decision");
const { AgentChange } = await import("@/models/agent-change");
const { UsageEvent } = await import("@/models/usage-event");
const { Session } = await import("@/models/session");
const { HealthSnapshot } = await import("@/models/health-snapshot");

// ---------- Organization ----------
describe("Organization model", () => {
  it("creates an organization with all required fields", async () => {
    const org = await Organization.create({
      name: "TestOrg",
      org_key_prefix: "an_org_testtest",
      org_key_hash: "$2a$12$fakehashvalue",
      invite_code: "abc123",
    });

    expect(org.name).toBe("TestOrg");
    expect(org.org_key_prefix).toBe("an_org_testtest");
    expect(org.invite_code).toBe("abc123");
    expect(org._id).toBeDefined();
  });

  it("defaults plan to 'free'", async () => {
    const org = await Organization.create({
      name: "FreePlan",
      org_key_prefix: "an_org_freeplan",
      org_key_hash: "$2a$12$hash",
      invite_code: "free123",
    });

    expect(org.plan).toBe("free");
  });

  it("defaults created_at to a date", async () => {
    const org = await Organization.create({
      name: "Dated",
      org_key_prefix: "an_org_datedorg",
      org_key_hash: "$2a$12$hash",
      invite_code: "date123",
    });

    expect(org.created_at).toBeInstanceOf(Date);
  });

  it("rejects missing required fields", async () => {
    await expect(Organization.create({ plan: "free" })).rejects.toThrow();
  });

  it("enforces unique org_key_prefix", async () => {
    await Organization.create({
      name: "A",
      org_key_prefix: "an_org_uniqtest",
      org_key_hash: "h1",
      invite_code: "inv1",
    });

    await expect(
      Organization.create({
        name: "B",
        org_key_prefix: "an_org_uniqtest",
        org_key_hash: "h2",
        invite_code: "inv2",
      }),
    ).rejects.toThrow();
  });
});

// ---------- Developer ----------
describe("Developer model", () => {
  it("creates a developer with all fields", async () => {
    const org = await Organization.create({
      name: "Org",
      org_key_prefix: "an_org_devtest1",
      org_key_hash: "hash",
      invite_code: "devtest",
    });

    const dev = await Developer.create({
      org_id: org._id,
      name: "Alice",
      email: "alice@test.com",
      github_id: "alice123",
      dev_key_prefix: "an_dev_alicekey",
      dev_key_hash: "$2a$12$hash",
    });

    expect(dev.name).toBe("Alice");
    expect(dev.email).toBe("alice@test.com");
    expect(dev.github_id).toBe("alice123");
    expect(dev.org_id.toString()).toBe(org._id.toString());
  });

  it("defaults role to 'member'", async () => {
    const org = await Organization.create({
      name: "Org",
      org_key_prefix: "an_org_roltest1",
      org_key_hash: "hash",
      invite_code: "roltest",
    });

    const dev = await Developer.create({
      org_id: org._id,
      name: "Bob",
      email: "bob@test.com",
      github_id: "bob456",
      dev_key_prefix: "an_dev_bobkey11",
      dev_key_hash: "$2a$12$hash",
    });

    expect(dev.role).toBe("member");
  });

  it("sets last_active_at to a date by default", async () => {
    const org = await Organization.create({
      name: "Org",
      org_key_prefix: "an_org_acttest1",
      org_key_hash: "hash",
      invite_code: "acttest",
    });

    const dev = await Developer.create({
      org_id: org._id,
      name: "Eve",
      email: "eve@test.com",
      github_id: "eve789",
      dev_key_prefix: "an_dev_evekey11",
      dev_key_hash: "$2a$12$hash",
    });

    expect(dev.last_active_at).toBeInstanceOf(Date);
  });
});

// ---------- Project ----------
describe("Project model", () => {
  it("creates a project with modules and deps", async () => {
    const org = await Organization.create({
      name: "Org",
      org_key_prefix: "an_org_prjtest1",
      org_key_hash: "hash",
      invite_code: "prjtest",
    });

    const project = await Project.create({
      org_id: org._id,
      name: "my-project",
      github_url: "https://github.com/test/repo",
      modules: [
        {
          name: "core",
          description: "Core module",
          paths: ["src/core/"],
          files_count: 10,
          loc: 500,
          exports_count: 20,
        },
      ],
      deps: [{ name: "react", version: "^19.0.0", kind: "prod", source: "package.json" }],
    });

    expect(project.name).toBe("my-project");
    expect(project.modules).toHaveLength(1);
    expect(project.modules[0].name).toBe("core");
    expect(project.deps).toHaveLength(1);
  });

  it("defaults modules and deps to empty arrays", async () => {
    const org = await Organization.create({
      name: "Org",
      org_key_prefix: "an_org_emptypr1",
      org_key_hash: "hash",
      invite_code: "emptypr",
    });

    const project = await Project.create({
      org_id: org._id,
      name: "empty-project",
    });

    expect(project.modules).toEqual([]);
    expect(project.deps).toEqual([]);
    expect(project.audit).toEqual([]);
  });

  it("defaults last_synced_at to a date", async () => {
    const org = await Organization.create({
      name: "Org",
      org_key_prefix: "an_org_syncpr1",
      org_key_hash: "hash",
      invite_code: "syncpr1",
    });

    const project = await Project.create({
      org_id: org._id,
      name: "sync-project",
    });

    expect(project.last_synced_at).toBeInstanceOf(Date);
  });
});

// ---------- Decision ----------
describe("Decision model", () => {
  it("creates a decision with required fields", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();

    const decision = await Decision.create({
      org_id: orgId,
      project_id: projectId,
      module: "auth",
      title: "Use JWT",
      decision: "We will use JWT for stateless auth",
    });

    expect(decision.title).toBe("Use JWT");
    expect(decision.module).toBe("auth");
    expect(decision.status).toBe("active");
    expect(decision.source).toBe("local");
    expect(decision.author_name).toBe("unknown");
  });

  it("rejects missing title", async () => {
    await expect(
      Decision.create({
        org_id: new mongoose.Types.ObjectId(),
        project_id: new mongoose.Types.ObjectId(),
        module: "x",
        decision: "y",
      }),
    ).rejects.toThrow();
  });

  it("rejects missing decision field", async () => {
    await expect(
      Decision.create({
        org_id: new mongoose.Types.ObjectId(),
        project_id: new mongoose.Types.ObjectId(),
        module: "x",
        title: "y",
      }),
    ).rejects.toThrow();
  });
});

// ---------- AgentChange ----------
describe("AgentChange model", () => {
  it("creates a change with required fields", async () => {
    const change = await AgentChange.create({
      org_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
      module: "ui",
      summary: "Refactored header",
      files_changed: ["src/Header.tsx"],
    });

    expect(change.summary).toBe("Refactored header");
    expect(change.breaking).toBe(false);
    expect(change.files_changed).toEqual(["src/Header.tsx"]);
    expect(change.author_name).toBe("unknown");
  });

  it("defaults breaking to false", async () => {
    const change = await AgentChange.create({
      org_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
      module: "api",
      summary: "Added endpoint",
    });

    expect(change.breaking).toBe(false);
  });
});

// ---------- UsageEvent ----------
describe("UsageEvent model", () => {
  it("creates an event with required fields", async () => {
    const event = await UsageEvent.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      action: "get_context",
      module: "core",
      tokens_saved_estimate: 5000,
    });

    expect(event.action).toBe("get_context");
    expect(event.tokens_saved_estimate).toBe(5000);
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("defaults numeric fields to 0", async () => {
    const event = await UsageEvent.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      action: "list_modules",
    });

    expect(event.tokens_served).toBe(0);
    expect(event.tokens_saved_estimate).toBe(0);
  });
});

// ---------- Session ----------
describe("Session model", () => {
  it("creates a session with required fields", async () => {
    const session = await Session.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
    });

    expect(session.started_at).toBeInstanceOf(Date);
    expect(session.ended_at).toBeNull();
    expect(session.events_count).toBe(0);
    expect(session.tokens_input).toBe(0);
    expect(session.tokens_output).toBe(0);
    expect(session.tokens_saved_total).toBe(0);
    expect(session.modules_visited).toEqual([]);
    expect(session.tools_used).toEqual([]);
    expect(session.files_touched).toEqual([]);
  });

  it("can update fields after creation", async () => {
    const session = await Session.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
    });

    session.events_count = 5;
    session.tokens_saved_total = 10000;
    session.modules_visited = ["core", "auth"];
    session.ended_at = new Date();
    session.duration_mins = 15;
    await session.save();

    const found = await Session.findById(session._id);
    expect(found!.events_count).toBe(5);
    expect(found!.tokens_saved_total).toBe(10000);
    expect(found!.modules_visited).toEqual(["core", "auth"]);
    expect(found!.ended_at).toBeInstanceOf(Date);
    expect(found!.duration_mins).toBe(15);
  });

  it("can find sessions by project_id", async () => {
    const projectId = new mongoose.Types.ObjectId();

    await Session.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      project_id: projectId,
    });

    await Session.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      project_id: projectId,
    });

    const sessions = await Session.find({ project_id: projectId });
    expect(sessions).toHaveLength(2);
  });

  it("rejects missing required org_id", async () => {
    await expect(
      Session.create({
        dev_id: new mongoose.Types.ObjectId(),
        project_id: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toThrow();
  });

  it("defaults string fields to empty string", async () => {
    const session = await Session.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
    });

    expect(session.branch).toBe("");
    expect(session.repo_url).toBe("");
    expect(session.claude_model).toBe("");
    expect(session.conversation_id).toBe("");
  });

  it("defaults numeric counters to 0", async () => {
    const session = await Session.create({
      org_id: new mongoose.Types.ObjectId(),
      dev_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
    });

    expect(session.files_changed_count).toBe(0);
    expect(session.changes_logged).toBe(0);
    expect(session.decisions_logged).toBe(0);
    expect(session.errors_count).toBe(0);
    expect(session.duration_mins).toBe(0);
  });
});

// ---------- HealthSnapshot ----------
describe("HealthSnapshot model", () => {
  it("creates a snapshot with required fields", async () => {
    const snapshot = await HealthSnapshot.create({
      org_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
      score: 85,
      checks: [{ name: "modules", status: "pass", detail: "3 modules" }],
    });

    expect(snapshot.score).toBe(85);
    expect(snapshot.checks).toHaveLength(1);
    expect(snapshot.created_at).toBeInstanceOf(Date);
  });

  it("defaults numeric fields to 0", async () => {
    const snapshot = await HealthSnapshot.create({
      org_id: new mongoose.Types.ObjectId(),
      project_id: new mongoose.Types.ObjectId(),
      score: 50,
    });

    expect(snapshot.modules_count).toBe(0);
    expect(snapshot.files_count).toBe(0);
    expect(snapshot.loc).toBe(0);
    expect(snapshot.dead_files).toBe(0);
    expect(snapshot.vuln_count).toBe(0);
  });

  it("rejects missing score", async () => {
    await expect(
      HealthSnapshot.create({
        org_id: new mongoose.Types.ObjectId(),
        project_id: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toThrow();
  });
});
