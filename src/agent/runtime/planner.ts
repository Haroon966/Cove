export interface PlannerStep {
  id: string;
  title: string;
  suggestedTools?: string[];
  dependsOnStepIds?: string[];
}

function sanitizeStep(input: string): string {
  return input
    .replace(/^\d+[\).\-\s]+/, "")
    .replace(/^[-*]\s+/, "")
    .trim();
}

/**
 * Build a deterministic execution plan from a user goal.
 * Prefer explicit numbered/bulleted items when present; otherwise split by conjunctions.
 */
export function buildExecutionPlan(goal: string, maxSteps = 6): PlannerStep[] {
  const normalized = goal.trim();
  if (!normalized) return [];

  const numberedOrBulleted = normalized
    .split(/\n+/)
    .filter((line) => /^\s*\d+[\).\-\s]/.test(line) || /^\s*[-*]\s+/.test(line))
    .map((line) => sanitizeStep(line))
    .filter(Boolean);

  let rawSteps: string[];
  if (numberedOrBulleted.length > 0) {
    rawSteps = numberedOrBulleted;
  } else {
    rawSteps = normalized
      .split(/\b(?:then|and then|after that|next|finally|and)\b/gi)
      .map((part) => sanitizeStep(part))
      .filter((part) => part.length >= 4);
  }

  if (rawSteps.length === 0) {
    rawSteps = [normalized];
  }

  return rawSteps.slice(0, Math.max(1, maxSteps)).map((title, index) => ({
    id: `step_${index + 1}`,
    title,
  }));
}

function inferSuggestedTools(text: string, availableTools: string[]): string[] {
  const lower = text.toLowerCase();
  const suggestions: string[] = [];
  const maybe = (tool: string, ...keywords: string[]) => {
    if (availableTools.includes(tool) && keywords.some((kw) => lower.includes(kw))) suggestions.push(tool);
  };
  maybe("read_file", "read", "inspect", "open file", "review");
  maybe("list_dir", "list", "directory", "folder", "tree");
  maybe("write_file", "write", "edit", "patch", "update file");
  maybe("run_shell_command", "run", "build", "test", "command", "shell");
  maybe("mcp_call_tool", "mcp", "external tool", "integrate");
  return Array.from(new Set(suggestions));
}

/**
 * Capability-aware extension over buildExecutionPlan:
 * - tags steps with likely tools
 * - infers dependencies when mutating steps should follow read/inspect steps
 */
export function buildCapabilityAwareExecutionPlan(
  goal: string,
  maxSteps: number,
  availableTools: string[],
  recentFailedTools: string[] = []
): PlannerStep[] {
  const base = buildExecutionPlan(goal, maxSteps);
  if (!base.length) return base;
  const failed = new Set(recentFailedTools);
  return base.map((step, idx) => {
    const suggested = inferSuggestedTools(step.title, availableTools).filter((tool) => !failed.has(tool));
    const dependsOn: string[] = [];
    if (
      idx > 0 &&
      (suggested.includes("write_file") || suggested.includes("run_shell_command") || suggested.includes("mcp_call_tool"))
    ) {
      dependsOn.push(base[idx - 1].id);
    }
    return {
      ...step,
      ...(suggested.length ? { suggestedTools: suggested } : {}),
      ...(dependsOn.length ? { dependsOnStepIds: dependsOn } : {}),
    };
  });
}

