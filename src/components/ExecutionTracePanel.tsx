import type { ExecutionTrace } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Activity } from "./Icons";

interface ExecutionTracePanelProps {
  traces: ExecutionTrace[];
  onClear: () => void;
}

function prettyPayload(payload: string): string {
  try { return JSON.stringify(JSON.parse(payload), null, 2); } catch { return payload; }
}

function traceVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
  if (type.includes("error") || type.includes("fail")) return "destructive";
  if (type.includes("tool") || type.includes("call")) return "secondary";
  return "outline";
}

function renderTraceHeadline(trace: ExecutionTrace): string | null {
  if (trace.trace_type !== "tool_result") return null;
  try {
    const payload = JSON.parse(trace.trace_payload) as {
      tool_name?: string | null;
      status?: string;
      duration_ms?: number;
      retries?: number;
      error_category?: string | null;
    };
    const pieces = [
      payload.tool_name ? `tool: ${payload.tool_name}` : null,
      payload.status ? `status: ${payload.status}` : null,
      payload.duration_ms != null ? `duration: ${payload.duration_ms}ms` : null,
      payload.retries ? `retries: ${payload.retries}` : null,
      payload.error_category ? `error: ${payload.error_category}` : null,
    ].filter(Boolean);
    return pieces.join(" | ");
  } catch {
    return null;
  }
}

export function ExecutionTracePanel({ traces, onClear }: ExecutionTracePanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-muted-foreground" />
          <span className="text-sm font-medium">Execution Traces ({traces.length})</span>
        </div>
        {traces.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClear}>
            <Trash2 size={12} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {traces.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center gap-2">
          <Activity size={24} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No traces recorded yet.</p>
        </div>
      ) : (
        <ScrollArea className="h-96">
          <div className="space-y-2 pr-2">
            {traces.map((t) => (
              <div key={t.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={traceVariant(t.trace_type)} className="text-xs">{t.trace_type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.created_at * 1000).toLocaleTimeString()}
                  </span>
                </div>
                {renderTraceHeadline(t) ? (
                  <div className="text-xs text-muted-foreground">{renderTraceHeadline(t)}</div>
                ) : null}
                <Separator />
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto max-h-32">
                  {prettyPayload(t.trace_payload)}
                </pre>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
