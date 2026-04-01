import { BUILT_IN_SKILLS, getSkillById, type SkillContext, type SkillRecommendation, type SkillTrustMode } from "./skillsCatalog";

interface ResolveSkillContextInput {
  manualSkillIds: string[];
  recommendations: SkillRecommendation[];
  trustModes: Record<string, SkillTrustMode>;
}

export function resolveSkillContext(input: ResolveSkillContextInput): SkillContext {
  const manualSet = new Set(input.manualSkillIds);
  const recommendationReasons: Record<string, string> = {};

  const autoRecommendedSkillIds = input.recommendations
    .filter((r) => !manualSet.has(r.skillId))
    .filter((r) => (input.trustModes[r.skillId] ?? "auto") === "auto")
    .map((r) => {
      recommendationReasons[r.skillId] = r.reason;
      return r.skillId;
    });

  const selectedSkillIds = Array.from(new Set([...input.manualSkillIds, ...autoRecommendedSkillIds]))
    .filter((id) => !!getSkillById(id));

  const instructions = selectedSkillIds.flatMap((id) => getSkillById(id)?.instructions ?? []);
  const allowed = new Set<string>();
  const denied = new Set<string>();
  const confirm = new Set<string>();

  for (const skillId of selectedSkillIds) {
    const skill = getSkillById(skillId);
    if (!skill) continue;
    for (const tool of skill.toolAllowList ?? []) allowed.add(tool);
    for (const tool of skill.toolDenyList ?? []) denied.add(tool);
    for (const tool of skill.requireConfirmFor ?? []) confirm.add(tool);
  }

  return {
    selectedSkillIds,
    autoRecommendedSkillIds,
    manualSkillIds: input.manualSkillIds,
    instructions,
    toolPolicy: {
      allowed_tools: allowed.size ? Array.from(allowed) : null,
      denied_tools: denied.size ? Array.from(denied) : null,
      require_confirmation_for: confirm.size ? Array.from(confirm) : null,
    },
    recommendationReasons,
  };
}

export function buildSkillPromptBlock(context: SkillContext): string {
  if (!context.selectedSkillIds.length) return "";
  const skillLines = context.selectedSkillIds.map((id) => {
    const skill = BUILT_IN_SKILLS.find((s) => s.id === id);
    return skill ? `- ${skill.title}: ${skill.description}` : `- ${id}`;
  });

  const instructionLines = context.instructions.map((line) => `- ${line}`);

  return [
    "Active skills for this turn:",
    ...skillLines,
    "",
    "Follow these skill directives:",
    ...instructionLines,
  ].join("\n");
}
