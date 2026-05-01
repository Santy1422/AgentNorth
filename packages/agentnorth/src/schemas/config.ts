import { z } from "zod";

export const ModuleConfigSchema = z.object({
  paths: z.array(z.string()).min(1),
  description: z.string().optional(),
  schema_source: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
});

export const EnforcementConfigSchema = z.object({
  level: z.enum(["soft", "strict", "audit"]).default("soft"),
  track_sessions: z.boolean().default(true),
  require_log_change: z.boolean().default(true),
  require_log_decision: z.boolean().default(false),
});

export const AgentNorthConfigSchema = z.object({
  version: z.number().int().min(1),
  project: z.object({
    name: z.string().min(1),
    framework: z.string().optional(),
  }),
  modules: z.record(z.string(), ModuleConfigSchema),
  ignore: z.array(z.string()).optional(),
  conventions: z.record(z.string(), z.string()).optional(),
  enforcement: EnforcementConfigSchema.optional(),
});
