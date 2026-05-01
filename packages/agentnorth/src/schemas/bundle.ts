import { z } from "zod";

export const GetContextInputSchema = z.object({
  module: z.string().min(1).describe("Module name to get context for"),
});

export const GetSchemaInputSchema = z.object({
  module: z.string().min(1).describe("Module name to get schema for"),
});

export const GetDecisionsInputSchema = z.object({
  module: z.string().optional().describe("Filter decisions by module (all if omitted)"),
});
