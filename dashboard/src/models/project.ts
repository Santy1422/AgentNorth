import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IModuleEmbed {
  name: string;
  description: string;
  paths: string[];
  files_count: number;
  loc: number;
  exports_count: number;
  dependencies: {
    internal: string[];
    external: string[];
  };
  schema: {
    tables: object[];
    mermaid_erd: string;
  };
  last_indexed_at: Date;
}

export interface IProject extends Document {
  org_id: Types.ObjectId;
  name: string;
  github_url: string;
  modules: IModuleEmbed[];
  last_synced_at: Date;
}

// Use untyped Schema to avoid mongoose SubDocument scope errors in serverless
const ProjectSchema = new Schema({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  name: { type: String, required: true },
  github_url: { type: String, default: "" },
  modules: { type: [Schema.Types.Mixed], default: [] },
  last_synced_at: { type: Date, default: Date.now },
});

export const Project =
  (mongoose.models.Project as mongoose.Model<IProject>) ||
  mongoose.model<IProject>("Project", ProjectSchema);
