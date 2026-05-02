import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISession extends Document {
  org_id: Types.ObjectId;
  dev_id: Types.ObjectId;
  project_id: Types.ObjectId;
  started_at: Date;
  ended_at: Date | null;

  // Git context
  branch: string;
  repo_url: string;

  // Accumulated during session (via $inc / $addToSet from events)
  events_count: number;
  tokens_input: number;
  tokens_output: number;
  tokens_saved_total: number;
  modules_visited: string[];
  tools_used: string[];
  files_touched: string[];

  // Set on session end
  files_changed_count: number;
  changes_logged: number;
  decisions_logged: number;
  errors_count: number;
  commit_shas: string[];
  edits_count: number;
  bash_commands_count: number;

  // Claude metadata
  claude_model: string;
  conversation_id: string;

  // Duration helper (virtual or computed on end)
  duration_mins: number;
}

const SessionSchema = new Schema<ISession>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  dev_id: { type: Schema.Types.ObjectId, ref: "Developer", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  started_at: { type: Date, default: Date.now },
  ended_at: { type: Date, default: null },

  // Git context
  branch: { type: String, default: "" },
  repo_url: { type: String, default: "" },

  // Accumulated during session
  events_count: { type: Number, default: 0 },
  tokens_input: { type: Number, default: 0 },
  tokens_output: { type: Number, default: 0 },
  tokens_saved_total: { type: Number, default: 0 },
  modules_visited: { type: [String], default: [] },
  tools_used: { type: [String], default: [] },
  files_touched: { type: [String], default: [] },

  // Set on session end
  files_changed_count: { type: Number, default: 0 },
  changes_logged: { type: Number, default: 0 },
  decisions_logged: { type: Number, default: 0 },
  errors_count: { type: Number, default: 0 },
  commit_shas: { type: [String], default: [] },
  edits_count: { type: Number, default: 0 },
  bash_commands_count: { type: Number, default: 0 },

  // Claude metadata
  claude_model: { type: String, default: "" },
  conversation_id: { type: String, default: "" },

  // Computed on end
  duration_mins: { type: Number, default: 0 },
});

// Find active sessions for a dev quickly
SessionSchema.index({ org_id: 1, dev_id: 1, ended_at: 1 });
// Dashboard queries: recent sessions per project
SessionSchema.index({ project_id: 1, started_at: -1 });
// Stale session cleanup
SessionSchema.index({ org_id: 1, ended_at: 1, started_at: 1 });

export const Session =
  mongoose.models.Session ||
  mongoose.model<ISession>("Session", SessionSchema);
