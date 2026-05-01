import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IAgentChange extends Document {
  org_id: Types.ObjectId;
  project_id: Types.ObjectId;
  module: string;
  summary: string;
  files_changed: string[];
  breaking: boolean;
  notes: string;
  author_dev_id: Types.ObjectId;
  author_name: string;
  created_at: Date;
}

const AgentChangeSchema = new Schema<IAgentChange>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  module: { type: String, required: true },
  summary: { type: String, required: true },
  files_changed: [String],
  breaking: { type: Boolean, default: false },
  notes: { type: String, default: "" },
  author_dev_id: { type: Schema.Types.ObjectId, ref: "Developer" },
  author_name: { type: String, default: "unknown" },
  created_at: { type: Date, default: Date.now },
});

AgentChangeSchema.index({ org_id: 1, project_id: 1, created_at: -1 });

export const AgentChange =
  mongoose.models.AgentChange ||
  mongoose.model<IAgentChange>("AgentChange", AgentChangeSchema);
