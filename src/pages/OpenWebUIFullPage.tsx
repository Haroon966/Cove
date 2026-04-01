import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "../api/tauri";
import type { AppConfig } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_URL = "http://127.0.0.1:8080";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export default function OpenWebUIFullPage() {
  const [targetUrl, setTargetUrl] = useState(DEFAULT_URL);
  const [draftUrl, setDraftUrl] = useState(DEFAULT_URL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<AppConfig>("config_load");
        const initial = normalizeUrl(cfg.base_url?.trim() || DEFAULT_URL);
        setTargetUrl(initial);
        setDraftUrl(initial);
      } catch {
        setTargetUrl(DEFAULT_URL);
        setDraftUrl(DEFAULT_URL);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const iframeSrc = useMemo(() => `${normalizeUrl(targetUrl)}/`, [targetUrl]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0 bg-card">
        <div>
          <h1 className="text-base font-semibold">Open WebUI Full Console</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Full Open WebUI feature surface embedded inside Cove.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/open-webui" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
            Back to Open WebUI Mode
          </Link>
          <Link to="/chat" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
            Back to Cove Chat
          </Link>
        </div>
      </header>

      {/* URL controls */}
      <div className="flex items-end gap-3 px-6 py-3 border-b border-border shrink-0 bg-background">
        <div className="flex-1 max-w-sm space-y-1">
          <Label htmlFor="openwebui-full-url" className="text-xs">Open WebUI URL</Label>
          <Input
            id="openwebui-full-url"
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="http://127.0.0.1:8080"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") setTargetUrl(normalizeUrl(draftUrl || DEFAULT_URL));
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setTargetUrl(normalizeUrl(draftUrl || DEFAULT_URL))}
          className="h-8"
        >
          Load
        </Button>
      </div>

      {/* Iframe or loading skeleton */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <iframe
            title="Open WebUI Full Console"
            className="w-full h-full border-0"
            src={iframeSrc}
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
