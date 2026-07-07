// packages/shared/src/preset.ts
import { z } from "zod";
import { StepSchema } from "./messages";

export type PresetId = string;
export type PresetCategory = "ecommerce" | "content";

export const PresetCategorySchema = z.enum(["ecommerce", "content"]);

const PresetBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: PresetCategorySchema,
  urlPatterns: z.array(z.string().min(1)).min(1),
  icon: z.string().optional(),
  version: z.number().int().min(1),
  sampleUrl: z.string().url().optional()
});

export const PromptPresetSchema = PresetBaseSchema.extend({
  kind: z.literal("prompt"),
  prompt: z.string().min(1)
});

export const ToolPresetSchema = PresetBaseSchema.extend({
  kind: z.literal("tool"),
  steps: z.array(StepSchema).min(1),
  expectedResultShape: z.unknown().optional()
});

export const PresetSchema = z.discriminatedUnion("kind", [
  PromptPresetSchema,
  ToolPresetSchema
]);

export type PromptPreset = z.infer<typeof PromptPresetSchema>;
export type ToolPreset   = z.infer<typeof ToolPresetSchema>;
export type Preset       = z.infer<typeof PresetSchema>;
