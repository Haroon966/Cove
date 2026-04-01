import { describe, expect, it } from "vitest";
import { metricIncrement, metricObserveDuration, snapshotMetrics } from "./metrics";

describe("metrics", () => {
  it("tracks counters and durations", () => {
    metricIncrement("chat_requests_total");
    metricObserveDuration("chat_request_duration", 123.8);
    const snap = snapshotMetrics();
    expect(snap.chat_requests_total).toBeGreaterThanOrEqual(1);
    expect(snap.chat_request_duration_ms).toBe(124);
  });
});

