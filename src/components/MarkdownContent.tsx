import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism as styleLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneDark as styleDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Play, Loader2, Terminal, X } from "./Icons";
import { invoke } from "../api/tauri";
import type { AppConfig } from "../types";
import {
  isBrowserCommandBridgeEnabled,
  runBrowserShellCommand,
} from "../api/browserCommandBridge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHELL_LANGS = new Set(["bash", "sh", "zsh", "shell", "powershell", "cmd"]);

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

interface RunShellResult {
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function CodeBlockCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const handleClick = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {});
  }, [text]);
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
        "bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
      )}
      onClick={handleClick}
      title={copied ? "Copied" : "Copy code"}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? (
        <><Check size={12} strokeWidth={2.5} /> Copied</>
      ) : (
        <><Copy size={12} strokeWidth={2} /> Copy</>
      )}
    </button>
  );
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  const theme = isDark ? styleDark : styleLight;
  const [confirmRun, setConfirmRun] = useState<{ command: string } | null>(null);
  const [runResults, setRunResults] = useState<Record<string, RunShellResult | { error: string }>>({});
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [bridgeConfig, setBridgeConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    invoke<AppConfig>("config_load")
      .then(setBridgeConfig)
      .catch(() => setBridgeConfig(null));
  }, []);

  const handleConfirmRun = useCallback(async () => {
    if (!confirmRun) return;
    const command = confirmRun.command;
    setConfirmRun(null);
    setRunningKey(command);
    try {
      const result = isTauri()
        ? await invoke<RunShellResult>("run_shell_command", { command })
        : await runBrowserShellCommand(command, bridgeConfig);
      setRunResults((prev) => ({ ...prev, [command]: result }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRunResults((prev) => ({ ...prev, [command]: { error: message } }));
    } finally {
      setRunningKey(null);
    }
  }, [confirmRun]);

  function paragraphContainsBlockCode(nodes: React.ReactNode): boolean {
    return React.Children.toArray(nodes).some((node) => {
      if (!React.isValidElement(node)) return false;
      const el = node as React.ReactElement<{ className?: string; inline?: boolean; children?: React.ReactNode }>;
      const props = el.props || {};
      if (props.className?.includes?.("code-block-wrap")) return true;
      const isBlockCode = /language-(\w+)/.test(props.className || "") && props.inline !== true;
      if (isBlockCode) return true;
      return paragraphContainsBlockCode(props.children ?? []);
    });
  }

  const components: Components = {
    p: ({ node: _node, children }) => {
      if (paragraphContainsBlockCode(children)) return <div>{children}</div>;
      return <p>{children}</p>;
    },
    pre: ({ node: _node, children }) => {
      const first = React.Children.toArray(children)[0];
      if (React.isValidElement(first) && (first.props as { className?: string })?.className?.includes?.("code-block-wrap")) {
        return <>{children}</>;
      }
      return <pre>{children}</pre>;
    },
    code: ({ node: _node, className, children, ...props }) => {
      const inline = (props as { inline?: boolean }).inline === true;
      const match = /language-(\w+)/.exec(className || "");
      const codeText = String(children).replace(/\n$/, "");
      if (!inline) {
        const lang = match ? match[1] : "text";
        const resultKey = codeText.trim();
        const bridgeEnabled = isBrowserCommandBridgeEnabled(bridgeConfig);
        const showRun =
          (isTauri() || bridgeEnabled) &&
          SHELL_LANGS.has(lang.toLowerCase()) &&
          resultKey.length > 0;
        const result = runResults[resultKey];
        const running = runningKey === resultKey;
        const highlightStyle = theme as unknown as { [key: string]: React.CSSProperties };
        return (
          <div className="code-block-wrap relative rounded-lg overflow-hidden border border-border my-2">
            {/* Action bar */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
              <CodeBlockCopyButton text={codeText} />
              {showRun && (
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border",
                    running
                      ? "bg-muted/80 text-muted-foreground border-border/60 cursor-not-allowed"
                      : "bg-muted/80 hover:bg-primary hover:text-primary-foreground text-muted-foreground border-border/60"
                  )}
                  onClick={() => setConfirmRun({ command: codeText.trim() })}
                  title="Run in terminal"
                  aria-label="Run in terminal"
                  disabled={running}
                >
                  {running ? (
                    <><Loader2 size={12} strokeWidth={2} className="animate-spin" /> Running…</>
                  ) : (
                    <><Play size={12} strokeWidth={2} /> Run</>
                  )}
                </button>
              )}
            </div>

            <SyntaxHighlighter
              style={highlightStyle}
              language={lang}
              PreTag="div"
              customStyle={{ margin: 0, padding: "1rem", paddingTop: "2.25rem", borderRadius: 0 }}
              codeTagProps={{ style: {} }}
            >
              {codeText}
            </SyntaxHighlighter>

            {/* Shell output */}
            {"error" in (result || {}) ? (
              <div className="border-t border-border bg-destructive/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-destructive font-medium mb-1">
                  <Terminal size={12} strokeWidth={2} aria-hidden />
                  Error
                </div>
                <pre className="text-destructive font-mono whitespace-pre-wrap">{(result as { error: string }).error}</pre>
              </div>
            ) : result ? (
              <div className="border-t border-border bg-muted/50 px-3 py-2 text-xs space-y-2">
                {(result as RunShellResult).stdout && (
                  <div>
                    <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1">
                      <Terminal size={12} strokeWidth={2} aria-hidden />
                      Output
                    </div>
                    <pre className="font-mono whitespace-pre-wrap text-foreground">{(result as RunShellResult).stdout}</pre>
                  </div>
                )}
                {(result as RunShellResult).stderr && (
                  <div>
                    <div className="text-yellow-600 dark:text-yellow-400 font-medium mb-1">Stderr</div>
                    <pre className="font-mono whitespace-pre-wrap text-yellow-700 dark:text-yellow-300">{(result as RunShellResult).stderr}</pre>
                  </div>
                )}
                <div className="text-muted-foreground">
                  Exit code: <span className="font-mono">{(result as RunShellResult).exit_code ?? "—"}</span>
                </div>
              </div>
            ) : null}
          </div>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={cn("markdown-content", className)}>
      {/* Run confirmation dialog */}
      {confirmRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="code-run-confirm-title"
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                <Terminal size={20} strokeWidth={1.75} className="text-orange-500" />
              </div>
              <div>
                <h3 id="code-run-confirm-title" className="font-semibold text-base">Run this command?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">This will execute in your system shell.</p>
              </div>
              <button
                type="button"
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => setConfirmRun(null)}
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-lg bg-muted border border-border p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{confirmRun.command}</pre>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmRun(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void handleConfirmRun()}>
                <Play size={14} strokeWidth={2} aria-hidden className="mr-1.5" />
                Run command
              </Button>
            </div>
          </div>
        </div>
      )}
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
