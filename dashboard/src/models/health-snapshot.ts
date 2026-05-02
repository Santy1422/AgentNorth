import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IHealthSnapshot extends Document {
  org_id: Types.ObjectId;
  project_id: Types.ObjectId;
  score: number;
  checks: { name: string; status: "pass" | "warn" | "fail"; detail: string }[];
  modules_count: number;
  files_count: number;
  loc: number;
  dead_files: number;
  vuln_count: number;
  created_at: Date;
}

const HealthSnapshotSchema = new Schema<IHealthSnapshot>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  score: { type: Number, required: true },
  checks: [{ name: String, status: String, detail: String }],
  modules_count: { type: Number, default: 0 },
  files_count: { type: Number, default: 0 },
  loc: { type: Number, default: 0 },
  dead_files: { type: Number, default: 0 },
  vuln_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});

HealthSnapshotSchema.index({ project_id: 1, created_at: -1 });

export const HealthSnapshot =
  mongoose.models.HealthSnapshot ||
  mongoose.model<IHealthSnapshot>("HealthSnapshot", HealthSnapshotSchema);
