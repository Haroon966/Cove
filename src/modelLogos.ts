/**
 * Map model name (id) to logo filename in public/model-logos/ (icons folder).
 * Longest prefixes first so "codellama" matches before "llama".
 * Uses the official logos you added; prefers -color when available.
 */
const MODEL_LOGO_PREFIXES: [string, string][] = [
  ["codellama", "codellama.svg"],
  ["deepseek", "deepseek-color.svg"],
  ["gemma", "gemma-color.svg"],
  ["llama", "llama.svg"],
  ["mixtral", "mixtral.svg"],
  ["mistral", "mistral-color.svg"],
  ["phi", "phi.svg"],
  ["qwen", "qwen-color.svg"],
];

export function getModelLogoPath(modelName: string): string | null {
  const lower = modelName.toLowerCase().trim();
  for (const [prefix, filename] of MODEL_LOGO_PREFIXES) {
    if (lower.startsWith(prefix)) return filename;
  }
  return null;
}

/** Base path for model logos (public/model-logos – icon folder). */
export const MODEL_LOGO_BASE = "/model-logos";
