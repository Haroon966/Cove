import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism as styleLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneDark as styleDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Play, Loader2, Terminal } from "./Icons";
import { invoke } from "../api/tauri";

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
      className="code-block-copy"
      onClick={handleClick}
      title={copied ? "Copied" : "Copy code"}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? (
        <><Check size={14} strokeWidth={2} /> Copied</>
      ) : (
        <><Copy size={14} strokeWidth={2} /> Copy</>
      )}
    </button>
  );
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const theme = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? styleDark : styleLight;
  const [confirmRun, setConfirmRun] = useState<{ command: string } | null>(null);
  const [runResults, setRunResults] = useState<Record<string, RunShellResult | { error: string }>>({});
  const [runningKey, setRunningKey] = useState<string | null>(null);

  const handleConfirmRun = useCallback(async () => {
    if (!confirmRun) return;
    const command = confirmRun.command;
    setConfirmRun(null);
    setRunningKey(command);
    try {
      const result = await invoke<RunShellResult>("run_shell_command", { command });
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
      if (paragraphContainsBlockCode(children)) return <div className="markdown-p-as-div">{children}</div>;
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
        const showRun = isTauri() && SHELL_LANGS.has(lang.toLowerCase()) && resultKey.length > 0;
        const result = runResults[resultKey];
        const running = runningKey === resultKey;
        const highlightStyle = theme as unknown as { [key: string]: React.CSSProperties };
        return (
          <div className="code-block-wrap">
            <div className="code-block-actions">
              <CodeBlockCopyButton text={codeText} />
              {showRun && (
                <button
                  type="button"
                  className={"code-block-run" + (running ? " is-running" : "")}
                  onClick={() => setConfirmRun({ command: codeText.trim() })}
                  title="Run in terminal"
                  aria-label="Run in terminal"
                  disabled={running}
                >
                  {running ? (
                    <><Loader2 size={14} strokeWidth={2} className="spin" /> Running…</>
                  ) : (
                    <><Play size={14} strokeWidth={2} /> Run</>
                  )}
                </button>
              )}
            </div>
            <SyntaxHighlighter
              style={highlightStyle}
              language={lang}
              PreTag="div"
              customStyle={{ margin: 0, padding: "1rem", paddingTop: "2.25rem", borderRadius: "0.5rem" }}
              codeTagProps={{ style: {} }}
            >
              {codeText}
            </SyntaxHighlighter>
            {"error" in (result || {}) ? (
              <div className="code-block-output code-block-output-error">
                <span className="code-block-output-header">
                  <Terminal size={12} strokeWidth={2} aria-hidden />
                  Error
                </span>
                <pre>{(result as { error: string }).error}</pre>
              </div>
            ) : result ? (
              <div className="code-block-output code-block-output-success">
                {(result as RunShellResult).stdout && (
                  <div className="code-block-output-section">
                    <span className="code-block-output-header">
                      <Terminal size={12} strokeWidth={2} aria-hidden />
                      Output
                    </span>
                    <pre>{(result as RunShellResult).stdout}</pre>
                  </div>
                )}
                {(result as RunShellResult).stderr && (
                  <div className="code-block-output-section code-block-output-stderr">
                    <span className="code-block-output-header">Stderr</span>
                    <pre>{(result as RunShellResult).stderr}</pre>
                  </div>
                )}
                <span className="code-block-output-exit">
                  Exit code: {(result as RunShellResult).exit_code ?? "—"}
                </span>
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
    <div className={className ? `markdown-body ${className}` : "markdown-body"}>
      {confirmRun && (
        <div className="code-run-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="code-run-confirm-title">
          <div className="code-run-confirm">
            <div className="code-run-confirm-header">
              <span className="code-run-confirm-icon" aria-hidden>
                <Terminal size={28} strokeWidth={1.75} />
              </span>
              <h3 id="code-run-confirm-title">Run this command?</h3>
              <p className="code-run-confirm-subtitle">This will execute in your system shell.</p>
            </div>
            <div className="code-run-confirm-command-wrap">
              <pre className="code-run-confirm-command">{confirmRun.command}</pre>
            </div>
            <div className="code-run-confirm-actions">
              <button type="button" className="code-run-confirm-cancel" onClick={() => setConfirmRun(null)}>
                Cancel
              </button>
              <button type="button" className="code-run-confirm-run" onClick={handleConfirmRun}>
                <Play size={16} strokeWidth={2} aria-hidden />
                Run command
              </button>
            </div>
          </div>
        </div>
      )}
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
