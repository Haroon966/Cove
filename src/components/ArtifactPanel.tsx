import { useMemo, useState } from "react";
import type { Artifact } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, FileText } from "./Icons";
import { cn } from "@/lib/utils";

interface ArtifactPanelProps {
  artifacts: Artifact[];
  onDelete: (artifactId: number) => void;
}

function formatTs(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function artifactPreviewText(a: Artifact): string {
  if (!a.payload) return "";
  try {
    const parsed = JSON.parse(a.payload) as { content?: string; summary?: string };
    return parsed.content ?? parsed.summary ?? a.payload;
  } catch {
    return a.payload;
  }
}

export function ArtifactPanel({ artifacts, onDelete }: ArtifactPanelProps) {
  const [selectedId, setSelectedId] = useState<number | null>(artifacts[0]?.id ?? null);
  const selected = useMemo(
    () => artifacts.find((a) => a.id === selectedId) ?? artifacts[0] ?? null,
    [artifacts, selectedId]
  );

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <FileText size={28} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No artifacts yet.</p>
        <p className="text-xs text-muted-foreground">Messages can be saved as artifacts from the chat.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[320px]">
      {/* Sidebar list */}
      <div className="w-44 shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Artifacts ({artifacts.length})
        </p>
        <ScrollArea className="h-80">
          <div className="space-y-1 pr-1">
            {artifacts.map((a) => (
              <button
                key={a.id}
                type="button"
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors",
                  selected?.id === a.id
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "hover:bg-muted text-foreground border border-transparent"
                )}
                onClick={() => setSelectedId(a.id)}
              >
                <p className="font-medium truncate">{a.title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground">{a.artifact_type}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator orientation="vertical" />

      {/* Detail view */}
      <div className="flex-1 min-w-0 space-y-3">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{selected.title || "Untitled"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">{selected.artifact_type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatTs(selected.created_at)}</span>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 size={13} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete artifact?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDelete(selected.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <ScrollArea className="h-64">
              <pre className="text-xs font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {artifactPreviewText(selected)}
              </pre>
            </ScrollArea>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select an artifact to preview it.</p>
        )}
      </div>
    </div>
  );
}
