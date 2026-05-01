import mongoose, { Schema, type Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  org_key_prefix: string;
  org_key_hash: string;
  plan: "free" | "team" | "enterprise";
  created_at: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true },
  org_key_prefix: { type: String, required: true, index: true, unique: true },
  org_key_hash: { type: String, required: true },
  plan: { type: String, enum: ["free", "team", "enterprise"], default: "free" },
  created_at: { type: Date, default: Date.now },
});

export const Organization =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);
