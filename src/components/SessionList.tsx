import { useMemo, useRef, useEffect } from "react";
import type { Session, SearchResult } from "../types";
import { MessageCircle, Plus, Search, Settings, Sparkles, Trash2 } from "./Icons";

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
  onOpenSettings,
}: SessionListProps) {
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
        <div className="sidebar-logo" aria-hidden><Sparkles size={24} strokeWidth={2} /></div>
        <div className="sidebar-brand">
          <h1 className="sidebar-brand-title">Cove</h1>
          <span className="sidebar-brand-version">Your Private Corner.</span>
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
                  <span className="sidebar-session-title">{item.title}</span>
                  {item.snippet != null && item.snippet !== item.title && (
                    <span className="sidebar-session-snippet">{item.snippet}</span>
                  )}
                </div>
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
