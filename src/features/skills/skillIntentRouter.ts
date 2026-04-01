import { BUILT_IN_SKILLS, type SkillRecommendation } from "./skillsCatalog";

function countPatternHits(pattern: string, source: string): number {
  try {
    const regex = new RegExp(pattern, "gi");
    const matches = source.match(regex);
    return matches?.length ?? 0;
  } catch {
    return 0;
  }
}

export function recommendSkillsFromPrompt(
  prompt: string,
  maxRecommendations = 3,
  context?: {
    recentFailedTools?: string[];
    recentSuccessfulTools?: string[];
    previousSkillIds?: string[];
  }
): SkillRecommendation[] {
  const normalized = prompt.toLowerCase();
  const recommendations: SkillRecommendation[] = [];

  for (const skill of BUILT_IN_SKILLS) {
    let score = 0;
    const reasons: string[] = [];

    const keywordHits = skill.triggerKeywords.reduce((acc, keyword) => {
      const hit = normalized.includes(keyword.toLowerCase());
      return hit ? acc + 1 : acc;
    }, 0);
    if (keywordHits > 0) {
      score += keywordHits * 10;
      reasons.push(`${keywordHits} keyword match${keywordHits > 1 ? "es" : ""}`);
    }

    const patternHits = (skill.triggerPatterns ?? []).reduce(
      (acc, pattern) => acc + countPatternHits(pattern, normalized),
      0
    );
    if (patternHits > 0) {
      score += patternHits * 14;
      reasons.push(`${patternHits} phrase match${patternHits > 1 ? "es" : ""}`);
    }

    if (normalized.length > 300 && skill.domain === "coding") {
      score += 2;
    }
    const failedTools = context?.recentFailedTools ?? [];
    if (
      failedTools.includes("run_shell_command") &&
      (skill.id === "debug-triage" || skill.id === "release-hardening")
    ) {
      score += 6;
      reasons.push("recent tool failures suggest triage");
    }
    const successfulTools = context?.recentSuccessfulTools ?? [];
    if (
      successfulTools.includes("write_file") &&
      (skill.id === "coding-refactor" || skill.id === "debug-triage")
    ) {
      score += 3;
      reasons.push("recent successful edit/tool context");
    }
    if ((context?.previousSkillIds ?? []).includes(skill.id)) {
      score += 2;
      reasons.push("continuity with previous turn");
    }

    if (score > 0) {
      recommendations.push({
        skillId: skill.id,
        score,
        reason: reasons.join(", ") || "intent match",
      });
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRecommendations);
}
