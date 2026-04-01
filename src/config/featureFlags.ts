import type { AppConfig } from "../types";

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  lobehubAgentBuilder: false,
  lobehubBranching: false,
  lobehubArtifacts: false,
  lobehubKnowledgeBase: false,
  lobehubMcpManager: false,
  lobehubDiscover: false,
  lobehubScheduling: false,
  runtimeExecutionTraces: true,
  "skills.autoRecommend.enabled": true,
};

export function resolveFeatureFlags(
  config: AppConfig | null | undefined
): Record<string, boolean> {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...(config?.feature_flags ?? {}),
  };
}

