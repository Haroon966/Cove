import { useMemo, useRef, useEffect, useState } from "react";
import type { Session, SearchResult } from "../types";
import { MessageCircle, Pencil, Plus, Search, Trash2 } from "./Icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  /** @deprecated Settings button moved to AppNav. */
  onOpenSettings?: () => void;
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
}: SessionListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

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

  const displayList = useMemo((): DisplayItem[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return sessions.map((s) => ({ id: s.id, title: s.title }));
    }
    if (searchInMessages && searchResults) {
      return searchResults.map((r) => ({
        id: r.session_id,
        title: r.title,
        snippet: r.snippet,
      }));
    }
    return sessions
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => ({ id: s.id, title: s.title }));
  }, [sessions, searchQuery, searchInMessages, searchResults]);

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-border bg-card h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Conversations
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onNew}
            title="New conversation"
            aria-label="New conversation"
          >
            <Plus size={15} strokeWidth={2.5} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            ref={searchInputRef}
            type="search"
            className="h-8 pl-8 pr-3 text-sm bg-muted/50 border-0 focus-visible:ring-1"
            placeholder="Search… (⌘K)"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            aria-label="Search sessions"
          />
        </div>

        {/* Search in messages toggle */}
        <label className="flex items-center gap-2 mt-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-border w-3 h-3 accent-primary"
            checked={searchInMessages}
            onChange={(e) => onSearchInMessagesChange(e.target.checked)}
          />
          <span className="text-xs text-muted-foreground">Search in messages</span>
        </label>
      </div>

      {/* Label */}
      <div className="px-3 pb-1">
        <span className="text-xs font-medium text-muted-foreground">
          {searchQuery.trim() && searchInMessages && searchResults
            ? "Results"
            : "History"}
        </span>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1 px-1.5">
        {displayList.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-3 text-center">
            <MessageCircle size={28} className="text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {searchQuery ? "No matching sessions" : "No conversations yet"}
            </p>
            {!searchQuery && (
              <Button size="sm" variant="outline" onClick={onNew} className="h-7 text-xs">
                <Plus size={13} className="mr-1" />
                New conversation
              </Button>
            )}
          </div>
        ) : (
          <ul className="pb-2 space-y-0.5">
            {displayList.map((item) => (
              <li key={item.id}>
                {editingId === item.id ? (
                  <div className="px-1.5 py-1">
                    <Input
                      ref={editInputRef}
                      type="text"
                      className="h-7 text-sm"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        const t = editingTitle.trim();
                        if (t && onRename) onRename(item.id, t);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          const t = editingTitle.trim();
                          if (t && onRename) onRename(item.id, t);
                          setEditingId(null);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Edit session title"
                    />
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors",
                      currentId === item.id
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(item.id);
                      }
                    }}
                  >
                    <MessageCircle
                      size={14}
                      strokeWidth={currentId === item.id ? 2.5 : 2}
                      className="shrink-0 text-current opacity-60"
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        className="block text-sm truncate leading-snug"
                        onDoubleClick={(e) => {
                          if (!onRename) return;
                          e.stopPropagation();
                          setEditingId(item.id);
                          setEditingTitle(item.title);
                        }}
                      >
                        {item.title}
                      </span>
                      {item.snippet && item.snippet !== item.title && (
                        <span className="block text-xs text-muted-foreground truncate mt-0.5">
                          {item.snippet}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {onRename && (
                        <button
                          type="button"
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(item.id);
                            setEditingTitle(item.title);
                          }}
                          title="Rename"
                          aria-label="Rename session"
                        >
                          <Pencil size={12} strokeWidth={2} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        title="Delete"
                        aria-label="Delete session"
                      >
                        <Trash2 size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
