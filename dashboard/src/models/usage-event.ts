import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IUsageEvent extends Document {
  org_id: Types.ObjectId;
  dev_id: Types.ObjectId;
  project_id: Types.ObjectId;
  session_id: string;
  action: string;
  module: string;
  tokens_served: number;
  tokens_saved_estimate: number;
  timestamp: Date;
}

const UsageEventSchema = new Schema<IUsageEvent>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  dev_id: { type: Schema.Types.ObjectId, ref: "Developer", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  session_id: { type: String, default: "" },
  action: { type: String, required: true },
  module: { type: String, default: "" },
  tokens_served: { type: Number, default: 0 },
  tokens_saved_estimate: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

// TTL: auto-delete after 90 days
UsageEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });
UsageEventSchema.index({ org_id: 1, dev_id: 1, timestamp: -1 });

export const UsageEvent =
  mongoose.models.UsageEvent ||
  mongoose.model<IUsageEvent>("UsageEvent", UsageEventSchema);
