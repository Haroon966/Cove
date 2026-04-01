# Agent Quality Evaluation

This project now includes a lightweight benchmark harness in `src/features/observability/agentQualityHarness.ts`.

## Benchmark Set

- `repo-summarize`: validate grounded code understanding with tool usage.
- `safe-refactor-plan`: validate planning and change safety guidance.
- `incident-triage`: validate debugging + corrective action quality.

## Metrics Tracked

- `agent_benchmark_runs_total`
- `agent_benchmark_completed_total`
- `agent_benchmark_tool_use_total`
- `agent_benchmark_corrections_total`
- `agent_benchmark_duration_ms`

## Suggested Rollout

1. Keep `agent.runtimeV2.enabled` on for internal testing.
2. If regression is detected, disable `agent.runtimeV2.enabled` to fall back to legacy tool execution semantics.
3. Keep `agent.planner.capabilityAware` enabled for step/tool hints, but disable if plans become noisy.
4. Compare benchmark score + median latency before/after each runtime change.
