import { invoke } from "../../api/tauri";
import type { AppConfig } from "../../types";

export type SkillDomain = "coding" | "design" | "ops";
export type SkillRisk = "low" | "medium" | "high";
export type SkillTrustMode = "auto" | "ask";

export interface BuiltInSkill {
  id: string;
  title: string;
  description: string;
  domain: SkillDomain;
  instructions: string[];
  triggerKeywords: string[];
  triggerPatterns?: string[];
  toolAllowList?: string[];
  toolDenyList?: string[];
  requireConfirmFor?: string[];
  risk: SkillRisk;
  defaultEnabled?: boolean;
  defaultTrustMode?: SkillTrustMode;
  telemetryTags?: string[];
}

export const BUILT_IN_SKILLS: BuiltInSkill[] = [
  {
    id: "coding-refactor",
    title: "Code Refactor Assistant",
    description: "Helps with safe refactors and dependency-aware edits.",
    domain: "coding",
    instructions: [
      "Prefer small, reversible refactor steps.",
      "Protect behavior by calling out regression risks and edge cases.",
      "When changing APIs, provide migration notes for impacted callers.",
    ],
    triggerKeywords: ["refactor", "cleanup", "restructure", "rename", "extract"],
    triggerPatterns: ["\\btech\\s*debt\\b", "\\bmoderni[sz]e\\b"],
    toolAllowList: ["read_file", "write_file", "list_dir", "run_shell_command"],
    requireConfirmFor: ["run_shell_command"],
    risk: "medium",
    defaultEnabled: true,
    defaultTrustMode: "ask",
    telemetryTags: ["coding", "refactor"],
  },
  {
    id: "debug-triage",
    title: "Debug Triage",
    description: "Guided bug isolation and runtime debugging workflow.",
    domain: "coding",
    instructions: [
      "Reproduce first, then isolate likely root cause before suggesting fixes.",
      "Rank hypotheses and verify with concrete evidence.",
      "Prefer minimal diffs and tests that protect against regressions.",
    ],
    triggerKeywords: ["bug", "error", "stack trace", "failing", "fix", "debug"],
    triggerPatterns: ["\\bdoesn'?t work\\b", "\\bregression\\b", "\\bexception\\b"],
    toolAllowList: ["read_file", "write_file", "list_dir", "run_shell_command"],
    requireConfirmFor: ["run_shell_command"],
    risk: "medium",
    defaultEnabled: true,
    defaultTrustMode: "ask",
    telemetryTags: ["coding", "debug"],
  },
  {
    id: "ui-ux-review",
    title: "UI/UX Review",
    description: "Heuristics for accessibility, hierarchy, and interaction quality.",
    domain: "design",
    instructions: [
      "Prioritize accessibility, readability, and interaction clarity.",
      "Highlight specific usability issues and suggest measurable improvements.",
      "Prefer existing design tokens/components over introducing visual drift.",
    ],
    triggerKeywords: ["ui", "ux", "a11y", "accessibility", "layout", "design", "review"],
    triggerPatterns: ["\\buser\\s*experience\\b", "\\bvisual\\s*hierarchy\\b"],
    toolAllowList: ["read_file", "write_file", "list_dir"],
    risk: "low",
    defaultEnabled: true,
    defaultTrustMode: "auto",
    telemetryTags: ["design", "review"],
  },
  {
    id: "release-hardening",
    title: "Release Hardening",
    description: "Checklist-driven release validation and risk checks.",
    domain: "ops",
    instructions: [
      "Treat release quality and rollback readiness as first-class outcomes.",
      "Run and report verification checks before claiming completion.",
      "Call out security, observability, and migration risks explicitly.",
    ],
    triggerKeywords: ["release", "ship", "deploy", "qa", "verify", "production"],
    triggerPatterns: ["\\bgo\\s*live\\b", "\\brelease\\s*checklist\\b"],
    toolAllowList: ["read_file", "write_file", "list_dir", "run_shell_command"],
    requireConfirmFor: ["run_shell_command"],
    risk: "high",
    defaultEnabled: false,
    defaultTrustMode: "ask",
    telemetryTags: ["ops", "release"],
  },
];

export interface SkillContext {
  selectedSkillIds: string[];
  autoRecommendedSkillIds: string[];
  manualSkillIds: string[];
  instructions: string[];
  toolPolicy: {
    allowed_tools: string[] | null;
    denied_tools: string[] | null;
    require_confirmation_for: string[] | null;
  };
  recommendationReasons: Record<string, string>;
}

export interface SkillRecommendation {
  skillId: string;
  score: number;
  reason: string;
}

export function getSkillById(skillId: string): BuiltInSkill | undefined {
  return BUILT_IN_SKILLS.find((skill) => skill.id === skillId);
}

export function getDefaultEnabledSkills(): string[] {
  return BUILT_IN_SKILLS.filter((skill) => skill.defaultEnabled).map((skill) => skill.id);
}

export async function loadEnabledSkills(): Promise<string[]> {
  const config = await invoke<AppConfig>("config_load");
  return config.enabled_skills ?? getDefaultEnabledSkills();
}

export async function setEnabledSkills(enabledSkillIds: string[]): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  await invoke("config_save", {
    config: {
      ...config,
      enabled_skills: enabledSkillIds,
    },
  });
}

export async function loadSkillTrustModes(): Promise<Record<string, SkillTrustMode>> {
  const config = await invoke<AppConfig>("config_load");
  return config.skill_trust_modes ?? {};
}

export async function setSkillTrustModes(
  trustModes: Record<string, SkillTrustMode>
): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  await invoke("config_save", {
    config: {
      ...config,
      skill_trust_modes: trustModes,
    },
  });
}

export async function loadSkillAutoRecommend(): Promise<boolean> {
  const config = await invoke<AppConfig>("config_load");
  return config.skill_auto_recommend ?? true;
}

export async function setSkillAutoRecommend(enabled: boolean): Promise<void> {
  const config = await invoke<AppConfig>("config_load");
  await invoke("config_save", {
    config: {
      ...config,
      skill_auto_recommend: enabled,
    },
  });
}

