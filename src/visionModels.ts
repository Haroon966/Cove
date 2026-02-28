/**
 * Known vision-capable model ID patterns for OpenAI-compatible backends.
 * /v1/models does not expose vision, so we use a heuristic list.
 */

const VISION_PATTERNS = [
  "gpt-4o",
  "gpt-4-vision",
  "gpt-4-turbo",
  "gpt-4o-mini",
  "gpt-4.5",
  "o1-preview",
  "gemini",
  "claude-3",
  "claude-4",
  "llava",
  "vision",
  "bakllava",
  "moondream",
  "minicpm-v",
  "pixtral",
  "llama-3.2-11b-vision",
  "llama-3.2-90b-vision",
];

export function isOpenAIVisionModel(modelId: string): boolean {
  if (!modelId?.trim()) return false;
  const lower = modelId.toLowerCase().trim();
  return VISION_PATTERNS.some((p) => lower.includes(p));
}
