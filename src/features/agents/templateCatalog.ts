import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  tags?: string[] | null;
}

export const CURATED_AGENT_MARKETPLACE: AgentTemplate[] = [
  {
    id: "research-analyst",
    name: "Research Analyst",
    description: "Deep multi-source analysis with concise synthesis.",
    system_prompt:
      "You are a meticulous research analyst. Verify claims, cite assumptions, and produce concise actionable summaries.",
    tags: ["analysis", "research"],
  },
  {
    id: "code-review-guardian",
    name: "Code Review Guardian",
    description: "Risk-focused reviewer for bugs, regressions, and missing tests.",
    system_prompt:
      "You are a strict code reviewer. Prioritize correctness, regressions, edge cases, and test coverage gaps.",
    tags: ["engineering", "quality"],
  },
  {
    id: "product-writer",
    name: "Product Writer",
    description: "PRDs, changelogs, and release docs with clear structure.",
    system_prompt:
      "You are a product writer. Produce structured docs with concise language, explicit assumptions, and clear acceptance criteria.",
    tags: ["docs", "product"],
  },
];

export async function listInstalledAgentTemplates(): Promise<AgentTemplate[]> {
  const config = await invoke<AppConfig>("config_load");
  return config.agent_templates ?? [];
}

export async function installAgentTemplate(templateId: string): Promise<void> {
  const template = CURATED_AGENT_MARKETPLACE.find((t) => t.id === templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);
  const config = await invoke<AppConfig>("config_load");
  const existing = config.agent_templates ?? [];
  const idx = existing.findIndex((t) => t.id === template.id);
  const next = idx >= 0 ? existing.map((t, i) => (i === idx ? template : t)) : [...existing, template];
  await invoke("config_save", { config: { ...config, agent_templates: next } });
}

export async function removeAgentTemplate(templateId: string): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  const existing = config.agent_templates ?? [];
  const next = existing.filter((t) => t.id !== templateId);
  await invoke("config_save", { config: { ...config, agent_templates: next } });
}

