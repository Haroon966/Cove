import { useMemo, useRef, useEffect, useState } from "react";
import type { Session, SearchResult } from "../types";
import { MessageCircle, Pencil, Plus, Search, Settings, Trash2 } from "./Icons";

interface SessionListProps {
  sessions: Session[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchInMessages: boolean;
  onSearchInMessagesChange: (v: boolean) => void;
  searchResults: SearchResult[] | null;
  currentId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onRename?: (sessionId: number, title: string) => void;
  onOpenSettings: () => void;
}

interface DisplayItem {
  id: number;
  title: string;
  snippet?: string;
}

export function SessionList({
  sessions,
  searchQuery,
  onSearchQueryChange,
  searchInMessages,
  onSearchInMessagesChange,
  searchResults,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onOpenSettings,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as unknown as { __TAURI__?: unknown }).__TAURI__) return;
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const displayList = useMemo((): DisplayItem[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return sessions.map((s) => ({ id: s.id, title: s.title }));
    }
    if (searchInMessages && searchResults) {
      return searchResults.map((r) => ({ id: r.session_id, title: r.title, snippet: r.snippet }));
    }
    return sessions
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => ({ id: s.id, title: s.title }));
  }, [sessions, searchQuery, searchInMessages, searchResults]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo" aria-hidden>
          <img src={`${import.meta.env.BASE_URL}cove-logo-color.png`} alt="" width={24} height={24} />
        </div>
        <div className="sidebar-brand">
          <h1 className="sidebar-brand-title">Cove</h1>
          <span className="sidebar-brand-version">
            Your Private Corner.{appVersion ? ` · v${appVersion}` : ""}
          </span>
        </div>
      </div>
      <button type="button" className="btn-new-session" onClick={onNew}>
        <Plus size={18} strokeWidth={2} aria-hidden />
        <span>New Session</span>
      </button>
      <nav className="sidebar-nav">
        <div className="sidebar-search">
          <span className="sidebar-search-icon" aria-hidden><Search size={16} strokeWidth={2} /></span>
          <input
            ref={searchInputRef}
            type="search"
            className="sidebar-search-input"
            placeholder="Search sessions… (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            aria-label="Search sessions"
          />
        </div>
        <label className="sidebar-search-in-messages">
          <input
            type="checkbox"
            checked={searchInMessages}
            onChange={(e) => onSearchInMessagesChange(e.target.checked)}
          />
          <span>Search in messages</span>
        </label>
        <p className="sidebar-nav-label">
          {searchQuery.trim() && searchInMessages && searchResults ? "Search results" : "History"}
        </p>
        <ul className="sidebar-sessions">
          {displayList.map((item) => (
            <li key={item.id}>
              <div
                role="button"
                tabIndex={0}
                className={"sidebar-session" + (currentId === item.id ? " active" : "")}
                onClick={() => onSelect(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(item.id);
                  }
                }}
              >
                <span className="sidebar-session-icon" aria-hidden><MessageCircle size={18} strokeWidth={2} /></span>
                <div className="sidebar-session-text">
                  {editingId === item.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="sidebar-session-edit-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        const t = editingTitle.trim();
                        if (t && onRename) {
                          onRename(item.id, t);
                        }
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          const t = editingTitle.trim();
                          if (t && onRename) {
                            onRename(item.id, t);
                          }
                          setEditingId(null);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Edit session title"
                    />
                  ) : (
                    <>
                      <span
                        className="sidebar-session-title"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (onRename) {
                            setEditingId(item.id);
                            setEditingTitle(item.title);
                          }
                        }}
                      >
                        {item.title}
                      </span>
                      {item.snippet != null && item.snippet !== item.title && (
                        <span className="sidebar-session-snippet">{item.snippet}</span>
                      )}
                    </>
                  )}
                </div>
                {editingId !== item.id && (
                  <>
                    {onRename && (
                      <button
                        type="button"
                        className="sidebar-session-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(item.id);
                          setEditingTitle(item.title);
                        }}
                        title="Rename session"
                        aria-label="Rename session"
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="sidebar-session-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      title="Delete session"
                      aria-label="Delete session"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer-btn"
          onClick={onOpenSettings}
        >
          <span className="sidebar-footer-btn-icon" aria-hidden><Settings size={18} strokeWidth={2} /></span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
