/**
 * Transcript Collector — Parses Claude Code JSONL transcripts
 * and extracts full session telemetry for the AgentNorth API.
 *
 * Claude Code stores transcripts at:
 *   ~/.claude/projects/{encoded-project-path}/{session-id}.jsonl
 *
 * Each line is a JSON object with these types:
 *   - "user"      → user messages (has cwd, sessionId, gitBranch, permissionMode)
 *   - "assistant"  → Claude responses (has message.usage with real token counts, message.model, message.content)
 *   - "progress"   → tool execution progress (has slug for tool name)
 *   - "system"     → system messages (context injection, compaction)
 *   - "file-history-snapshot" → file state snapshots
 *   - "queue-operation" → internal queue ops
 *   - "last-prompt" → final prompt
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export interface TranscriptSummary {
  session_id: string;
  project_path: string;
  git_branch: string;
  permission_mode: string;
  claude_model: string;

  // Real token usage from Anthropic API responses
  tokens_input: number;
  tokens_output: number;
  tokens_cache_read: number;
  tokens_cache_creation: number;

  // Turn counts
  assistant_turns: number;
  user_turns: number;

  // Tool usage breakdown
  tool_calls: Record<string, number>;

  // Timeline
  started_at: string;
  ended_at: string;

  // Content summary (not full conversation — that would be too large)
  user_messages_count: number;
  user_messages_preview: string[]; // first 5 user messages (truncated to 200 chars)
  files_mentioned: string[]; // files referenced in tool calls

  // Subagent info
  subagent_count: number;
}

interface TranscriptLine {
  type: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  permissionMode?: string;
  timestamp?: number;
  message?: {
    role?: string;
    model?: string;
    content?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  slug?: string;
  // Tool input for progress events
  data?: {
    tool_input?: {
      file_path?: string;
      command?: string;
      pattern?: string;
    };
  };
}

function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

function findTranscriptPath(projectPath: string, sessionId?: string): string | null {
  const claudeDir = join(homedir(), ".claude", "projects");
  const encoded = encodeProjectPath(projectPath);

  const projectDir = join(claudeDir, encoded);
  if (!existsSync(projectDir)) return null;

  if (sessionId) {
    const path = join(projectDir, `${sessionId}.jsonl`);
    return existsSync(path) ? path : null;
  }

  // Find most recent JSONL file
  const files = readdirSync(projectDir)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => ({
      name: f,
      path: join(projectDir, f),
      mtime: existsSync(join(projectDir, f))
        ? require("fs").statSync(join(projectDir, f)).mtimeMs
        : 0,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files[0]?.path || null;
}

export function parseTranscript(transcriptPath: string): TranscriptSummary {
  const content = readFileSync(transcriptPath, "utf8");
  const lines = content.trim().split("\n");

  const summary: TranscriptSummary = {
    session_id: "",
    project_path: "",
    git_branch: "",
    permission_mode: "",
    claude_model: "",
    tokens_input: 0,
    tokens_output: 0,
    tokens_cache_read: 0,
    tokens_cache_creation: 0,
    assistant_turns: 0,
    user_turns: 0,
    tool_calls: {},
    started_at: "",
    ended_at: "",
    user_messages_count: 0,
    user_messages_preview: [],
    files_mentioned: [],
    subagent_count: 0,
  };

  const filesSet = new Set<string>();
  let firstTimestamp = Infinity;
  let lastTimestamp = 0;

  for (const line of lines) {
    let obj: TranscriptLine;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    // Track timestamps
    if (obj.timestamp) {
      if (obj.timestamp < firstTimestamp) firstTimestamp = obj.timestamp;
      if (obj.timestamp > lastTimestamp) lastTimestamp = obj.timestamp;
    }

    switch (obj.type) {
      case "user": {
        summary.user_turns++;
        summary.user_messages_count++;

        // Extract metadata from first user message
        if (!summary.session_id && obj.sessionId) {
          summary.session_id = obj.sessionId;
        }
        if (!summary.project_path && obj.cwd) {
          summary.project_path = obj.cwd;
        }
        if (!summary.git_branch && obj.gitBranch) {
          summary.git_branch = obj.gitBranch;
        }
        if (!summary.permission_mode && obj.permissionMode) {
          summary.permission_mode = obj.permissionMode;
        }

        // Capture first 5 user messages as preview
        if (summary.user_messages_preview.length < 5 && obj.message) {
          const content = obj.message.content;
          if (typeof content === "string") {
            summary.user_messages_preview.push(content.slice(0, 200));
          } else if (Array.isArray(content)) {
            const textPart = (content as Array<{ type: string; text?: string }>).find(c => c.type === "text");
            if (textPart?.text) {
              summary.user_messages_preview.push(textPart.text.slice(0, 200));
            }
          }
        }
        break;
      }

      case "assistant": {
        summary.assistant_turns++;

        if (obj.message) {
          // Extract model
          if (obj.message.model && !summary.claude_model) {
            summary.claude_model = obj.message.model;
          }

          // Accumulate real token usage
          if (obj.message.usage) {
            summary.tokens_input += obj.message.usage.input_tokens || 0;
            summary.tokens_output += obj.message.usage.output_tokens || 0;
            summary.tokens_cache_read += obj.message.usage.cache_read_input_tokens || 0;
            summary.tokens_cache_creation += obj.message.usage.cache_creation_input_tokens || 0;
          }

          // Extract file paths from tool_use content blocks
          if (Array.isArray(obj.message.content)) {
            for (const block of obj.message.content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>) {
              if (block.type === "tool_use" && block.name) {
                summary.tool_calls[block.name] = (summary.tool_calls[block.name] || 0) + 1;
                // Extract file paths
                if (block.input?.file_path && typeof block.input.file_path === "string") {
                  filesSet.add(block.input.file_path);
                }
              }
            }
          }
        }
        break;
      }

      case "progress": {
        if (obj.slug) {
          // Progress events have obfuscated slugs, count them
          summary.tool_calls["_progress"] = (summary.tool_calls["_progress"] || 0) + 1;
        }
        break;
      }
    }
  }

  // Set timestamps
  if (firstTimestamp < Infinity) {
    summary.started_at = new Date(firstTimestamp).toISOString();
  }
  if (lastTimestamp > 0) {
    summary.ended_at = new Date(lastTimestamp).toISOString();
  }

  summary.files_mentioned = [...filesSet].slice(0, 100);

  // Count subagents
  const sessionDir = transcriptPath.replace(".jsonl", "");
  if (existsSync(join(sessionDir, "subagents"))) {
    try {
      summary.subagent_count = readdirSync(join(sessionDir, "subagents"))
        .filter(f => f.endsWith(".jsonl")).length;
    } catch {}
  }

  return summary;
}

export function collectCurrentSession(projectPath: string, sessionId?: string): TranscriptSummary | null {
  const transcriptPath = findTranscriptPath(projectPath, sessionId);
  if (!transcriptPath) return null;

  try {
    return parseTranscript(transcriptPath);
  } catch (err) {
    console.error("[agentnorth] Failed to parse transcript:", err instanceof Error ? err.message : err);
    return null;
  }
}
