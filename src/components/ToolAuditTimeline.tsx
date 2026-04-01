import type { Message } from "../types";
import type { ExecutionTrace } from "../types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ToolAuditTimelineProps {
  messages: Message[];
  traces?: ExecutionTrace[];
}

function formatTime(unixSeconds: number): string {
  if (!unixSeconds) return "-";
  return new Date(unixSeconds * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface ToolRunSummary {
  id: string;
  tool_name: string;
  status: "success" | "error";
  duration_ms?: number | null;
  retries: number;
  error_category?: string | null;
  created_at: number;
}

function parseToolSummaries(traces: ExecutionTrace[]): ToolRunSummary[] {
  return traces
    .filter((t) => t.trace_type === "tool_result")
    .map((t) => {
      try {
        const p = JSON.parse(t.trace_payload) as {
          tool_call_id?: string;
          tool_name?: string | null;
          status?: "success" | "error";
          duration_ms?: number | null;
          retries?: number;
          error_category?: string | null;
        };
        return {
          id: p.tool_call_id ?? String(t.id),
          tool_name: p.tool_name ?? "unknown_tool",
          status: p.status ?? "success",
          duration_ms: p.duration_ms ?? null,
          retries: p.retries ?? 0,
          error_category: p.error_category ?? null,
          created_at: t.created_at,
        };
      } catch {
        return null;
      }
    })
    .filter((row): row is ToolRunSummary => !!row)
    .slice(-20)
    .reverse();
}

export function ToolAuditTimeline({ messages, traces = [] }: ToolAuditTimelineProps) {
  const events = messages.filter(
    (m) => m.event_type === "tool_call" || m.event_type === "tool_result"
  );
  const summaries = parseToolSummaries(traces);
  if (!events.length) return null;

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tool Audit</span>
        <Badge variant="secondary" className="text-[10px] h-4">{events.length}</Badge>
      </div>
      <ScrollArea className="max-h-36">
        <div className="space-y-1.5 pr-2">
          {summaries.map((summary) => (
            <div key={`summary-${summary.id}-${summary.created_at}`} className="flex items-start gap-2">
              <Badge
                variant={summary.status === "error" ? "destructive" : "secondary"}
                className="text-[10px] shrink-0 mt-0.5"
              >
                {summary.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">{formatTime(summary.created_at)} · </span>
                <span className="text-xs text-foreground/80">{summary.tool_name}</span>
                {summary.duration_ms != null ? (
                  <span className="text-xs text-muted-foreground"> · {summary.duration_ms}ms</span>
                ) : null}
                {summary.retries > 0 ? (
                  <span className="text-xs text-muted-foreground"> · retries {summary.retries}</span>
                ) : null}
                {summary.error_category ? (
                  <span className="text-xs text-destructive"> · {summary.error_category}</span>
                ) : null}
              </div>
            </div>
          ))}
          {events.map((m) => (
            <div key={`${m.id}-${m.created_at}`} className="flex items-start gap-2">
              <Badge
                variant={m.event_type === "tool_call" ? "secondary" : "outline"}
                className="text-[10px] shrink-0 mt-0.5"
              >
                {m.event_type === "tool_call" ? "call" : "result"}
              </Badge>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">{formatTime(m.created_at)} · </span>
                <span className="text-xs text-foreground/80 truncate">{m.content.slice(0, 160)}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
