import { addBackendAuditLog } from "../logging/backendAuditLog";

const counters: Record<string, number> = {};

export function metricIncrement(name: string, value = 1): void {
  counters[name] = (counters[name] ?? 0) + value;
}

export function metricObserveDuration(name: string, durationMs: number): void {
  const bucket = `${name}_ms`;
  counters[bucket] = Math.round(durationMs);
}

export function snapshotMetrics(): Record<string, number> {
  return { ...counters };
}

export async function flushMetrics(event = "runtime_metrics_flush"): Promise<void> {
  await addBackendAuditLog("info", event, snapshotMetrics());
}

