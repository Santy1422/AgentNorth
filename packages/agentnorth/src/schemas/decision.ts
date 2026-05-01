import { z } from "zod";

export const LogDecisionInputSchema = z.object({
  module: z.string().min(1).describe("Module this decision applies to"),
  title: z.string().min(1).describe("Short title of the decision"),
  context: z.string().min(1).describe("Why this decision was needed"),
  decision: z.string().min(1).describe("What was decided"),
});

export const LogChangeInputSchema = z.object({
  module: z.string().min(1).describe("Module affected"),
  summary: z.string().min(1).describe("What changed"),
  files_changed: z.array(z.string()).min(1).describe("Files modified"),
  breaking: z.boolean().optional().describe("Is this a breaking change?"),
  notes: z.string().optional().describe("Additional context"),
});

export type LogDecisionInput = z.infer<typeof LogDecisionInputSchema>;
export type LogChangeInput = z.infer<typeof LogChangeInputSchema>;
