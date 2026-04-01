import { metricIncrement, metricObserveDuration } from "./metrics";

export interface AgentBenchmarkPrompt {
  id: string;
  title: string;
  prompt: string;
  expectsTools: boolean;
}

export interface AgentBenchmarkResult {
  benchmarkId: string;
  completed: boolean;
  usedTools: boolean;
  durationMs: number;
  requiredCorrections: number;
}

export const DEFAULT_AGENT_BENCHMARKS: AgentBenchmarkPrompt[] = [
  {
    id: "repo-summarize",
    title: "Summarize current module with evidence",
    prompt: "Inspect the current workspace and summarize how the API adapter layer works with concrete file references.",
    expectsTools: true,
  },
  {
    id: "safe-refactor-plan",
    title: "Produce safe refactor plan",
    prompt: "Review the active feature and propose a low-risk refactor plan with test strategy and rollback steps.",
    expectsTools: true,
  },
  {
    id: "incident-triage",
    title: "Debug and triage failure",
    prompt: "Investigate a failing flow, identify likely root cause, and provide the smallest verifiable fix.",
    expectsTools: true,
  },
];

export function scoreBenchmark(result: AgentBenchmarkResult): number {
  let score = 0;
  if (result.completed) score += 50;
  if (result.usedTools) score += 20;
  if (result.requiredCorrections === 0) score += 20;
  if (result.durationMs <= 25000) score += 10;
  return score;
}

export function recordBenchmarkResult(result: AgentBenchmarkResult): void {
  metricIncrement("agent_benchmark_runs_total");
  if (result.completed) metricIncrement("agent_benchmark_completed_total");
  if (result.usedTools) metricIncrement("agent_benchmark_tool_use_total");
  metricIncrement("agent_benchmark_corrections_total", result.requiredCorrections);
  metricObserveDuration("agent_benchmark_duration", result.durationMs);
}
