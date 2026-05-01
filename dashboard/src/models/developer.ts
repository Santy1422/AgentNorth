import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IDeveloper extends Document {
  org_id: Types.ObjectId;
  name: string;
  email: string;
  github_id: string;
  dev_key_prefix: string;
  dev_key_hash: string;
  role: "admin" | "member";
  created_at: Date;
  last_active_at: Date;
}

const DeveloperSchema = new Schema<IDeveloper>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  github_id: { type: String, required: true },
  dev_key_prefix: { type: String, required: true, index: true, unique: true },
  dev_key_hash: { type: String, required: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  created_at: { type: Date, default: Date.now },
  last_active_at: { type: Date, default: Date.now },
});

export const Developer =
  mongoose.models.Developer ||
  mongoose.model<IDeveloper>("Developer", DeveloperSchema);
