import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISession extends Document {
  org_id: Types.ObjectId;
  dev_id: Types.ObjectId;
  project_id: Types.ObjectId;
  started_at: Date;
  ended_at: Date | null;
  actions_count: number;
  tokens_total: number;
  tokens_saved_total: number;
  modules_visited: string[];
  tools_used: string[];
  files_touched: string[];
  branch: string;
  events_count: number;
}

const SessionSchema = new Schema<ISession>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  dev_id: { type: Schema.Types.ObjectId, ref: "Developer", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  started_at: { type: Date, default: Date.now },
  ended_at: { type: Date, default: null },
  actions_count: { type: Number, default: 0 },
  tokens_total: { type: Number, default: 0 },
  tokens_saved_total: { type: Number, default: 0 },
  modules_visited: { type: [String], default: [] },
  tools_used: { type: [String], default: [] },
  files_touched: { type: [String], default: [] },
  branch: { type: String, default: "" },
  events_count: { type: Number, default: 0 },
});

SessionSchema.index({ org_id: 1, started_at: -1 });

export const Session =
  mongoose.models.Session ||
  mongoose.model<ISession>("Session", SessionSchema);
