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

const ModuleEmbedSchema = new Schema<IModuleEmbed>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    paths: [String],
    files_count: { type: Number, default: 0 },
    loc: { type: Number, default: 0 },
    exports_count: { type: Number, default: 0 },
    dependencies: {
      internal: [String],
      external: [String],
    },
    schema: {
      tables: [Schema.Types.Mixed],
      mermaid_erd: { type: String, default: "" },
    },
    last_indexed_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ProjectSchema = new Schema<IProject>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  name: { type: String, required: true },
  github_url: { type: String, default: "" },
  modules: [ModuleEmbedSchema],
  last_synced_at: { type: Date, default: Date.now },
});

export const Project =
  mongoose.models.Project ||
  mongoose.model<IProject>("Project", ProjectSchema);
