import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDecision extends Document {
  org_id: Types.ObjectId;
  project_id: Types.ObjectId;
  module: string;
  title: string;
  context: string;
  decision: string;
  author_dev_id: Types.ObjectId;
  author_name: string;
  status: "active" | "superseded" | "deprecated";
  created_at: Date;
}

const DecisionSchema = new Schema<IDecision>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  module: { type: String, required: true },
  title: { type: String, required: true },
  context: { type: String, default: "" },
  decision: { type: String, required: true },
  author_dev_id: { type: Schema.Types.ObjectId, ref: "Developer" },
  author_name: { type: String, default: "unknown" },
  status: { type: String, enum: ["active", "superseded", "deprecated"], default: "active" },
  created_at: { type: Date, default: Date.now },
});

DecisionSchema.index({ org_id: 1, project_id: 1, created_at: -1 });

export const Decision =
  mongoose.models.Decision ||
  mongoose.model<IDecision>("Decision", DecisionSchema);
