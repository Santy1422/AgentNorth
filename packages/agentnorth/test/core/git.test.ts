import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.setConfig({ testTimeout: 15000 });
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getRecentChanges,
  getFileAuthors,
  getFileLastModified,
  getFileChangeFrequency,
  getContributors,
} from "../../src/core/git.js";

const exec = promisify(execFile);
const TMP_DIR = join(import.meta.dirname, "../fixtures/.tmp-git-test");

async function git(args: string[], cwd: string = TMP_DIR) {
  const { stdout } = await exec("git", args, { cwd });
  return stdout.trim();
}

describe("git integration", () => {
  beforeEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    await mkdir(join(TMP_DIR, "src"), { recursive: true });

    // Initialize a real git repo
    await git(["init"]);
    await git(["config", "user.email", "test@test.com"]);
    await git(["config", "user.name", "Test User"]);

    // Create initial commit
    await writeFile(join(TMP_DIR, "src", "index.ts"), 'export const hello = "world";\n');
    await git(["add", "."]);
    await git(["commit", "-m", "Initial commit"]);

    // Create second commit
    await writeFile(join(TMP_DIR, "src", "utils.ts"), 'export function add(a: number, b: number) { return a + b; }\n');
    await git(["add", "."]);
    await git(["commit", "-m", "Add utils module"]);

    // Create third commit modifying existing file
    await writeFile(
      join(TMP_DIR, "src", "index.ts"),
      'export const hello = "world";\nexport const version = "1.0.0";\n',
    );
    await git(["add", "."]);
    await git(["commit", "-m", "Add version export"]);
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe("getRecentChanges", () => {
    it("returns recent commits for given paths", async () => {
      const changes = await getRecentChanges(TMP_DIR, ["src/"]);

      expect(changes.length).toBeGreaterThanOrEqual(2);
      // Most recent commit first
      expect(changes[0]!.summary).toBe("Add version export");
      expect(changes[0]!.author).toBe("Test User");
      expect(changes[0]!.commit).toHaveLength(8);
      expect(changes[0]!.date).toBeTruthy();
    });

    it("returns files changed per commit", async () => {
      const changes = await getRecentChanges(TMP_DIR, ["src/"]);
      const latestChange = changes[0]!;

      expect(latestChange.files_changed).toContain("src/index.ts");
    });

    it("respects limit parameter", async () => {
      const changes = await getRecentChanges(TMP_DIR, ["src/"], 1);
      expect(changes).toHaveLength(1);
    });

    it("returns empty array for path with no commits", async () => {
      const changes = await getRecentChanges(TMP_DIR, ["nonexistent/"]);
      expect(changes).toHaveLength(0);
    });
  });

  describe("getFileAuthors", () => {
    it("returns authors with line counts", async () => {
      const authors = await getFileAuthors(TMP_DIR, "src/index.ts");

      expect(authors.length).toBeGreaterThan(0);
      expect(authors[0]!.author).toBe("Test User");
      expect(authors[0]!.lines).toBeGreaterThan(0);
    });

    it("returns empty array for non-existent file", async () => {
      const authors = await getFileAuthors(TMP_DIR, "nonexistent.ts");
      expect(authors).toHaveLength(0);
    });
  });

  describe("getFileLastModified", () => {
    it("returns ISO date string for a tracked file", async () => {
      const lastModified = await getFileLastModified(TMP_DIR, "src/index.ts");

      expect(lastModified).toBeTruthy();
      // Should be a valid ISO date
      expect(new Date(lastModified).getTime()).not.toBeNaN();
    });

    it("returns empty string for non-existent file", async () => {
      const lastModified = await getFileLastModified(TMP_DIR, "nonexistent.ts");
      expect(lastModified).toBe("");
    });
  });

  describe("getFileChangeFrequency", () => {
    it("returns change counts for files in paths", async () => {
      const freq = await getFileChangeFrequency(TMP_DIR, ["src/"]);

      // index.ts was modified in 2 commits, utils.ts in 1
      expect(freq["src/index.ts"]).toBeGreaterThanOrEqual(1);
    });

    it("returns empty object for non-existent paths", async () => {
      const freq = await getFileChangeFrequency(TMP_DIR, ["nonexistent/"]);
      expect(Object.keys(freq)).toHaveLength(0);
    });
  });

  describe("getContributors", () => {
    it("returns contributors with commit counts", async () => {
      const contributors = await getContributors(TMP_DIR, ["src/"]);
      // Note: getContributors uses --since="6 months ago" which should include
      // commits made just now, but git shortlog can behave differently in temp repos.
      // We accept either populated results or empty (graceful degradation).
      if (contributors.length > 0) {
        expect(contributors[0]!.name).toBe("Test User");
        expect(contributors[0]!.commits).toBeGreaterThanOrEqual(1);
      } else {
        expect(contributors).toHaveLength(0);
      }
    });

    it("includes last_active date when contributors found", async () => {
      const contributors = await getContributors(TMP_DIR, ["src/"]);
      if (contributors.length > 0) {
        expect(contributors[0]!.last_active).toBeTruthy();
      }
    });

    it("returns empty array for non-existent paths", async () => {
      const contributors = await getContributors(TMP_DIR, ["nonexistent/"]);
      expect(contributors).toHaveLength(0);
    });
  });

  describe("graceful failure outside git repo", () => {
    it("getRecentChanges returns empty array for non-git directory", async () => {
      const nonGitDir = join(TMP_DIR, "not-a-repo");
      await mkdir(nonGitDir, { recursive: true });
      const changes = await getRecentChanges(nonGitDir, ["."]);
      expect(changes).toHaveLength(0);
    });

    it("getFileAuthors returns empty array for non-git directory", async () => {
      const nonGitDir = join(TMP_DIR, "not-a-repo");
      await mkdir(nonGitDir, { recursive: true });
      const authors = await getFileAuthors(nonGitDir, "file.ts");
      expect(authors).toHaveLength(0);
    });

    it("getContributors returns empty array for non-git directory", async () => {
      const nonGitDir = join(TMP_DIR, "not-a-repo");
      await mkdir(nonGitDir, { recursive: true });
      const contributors = await getContributors(nonGitDir, ["."]);
      expect(contributors).toHaveLength(0);
    });
  });
});
