import type { Message, SearchResult, Session } from "../types";

export interface ChatStoreState {
  sessions: Session[];
  currentSessionId: number | null;
  messages: Message[];
  searchQuery: string;
  searchInMessages: boolean;
  searchResults: SearchResult[] | null;
  agentMode: boolean;
}

export const initialChatStoreState: ChatStoreState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  searchQuery: "",
  searchInMessages: false,
  searchResults: null,
  agentMode: false,
};

export type ChatStorePatch = Partial<ChatStoreState>;

export function patchChatState(
  prev: ChatStoreState,
  patch: ChatStorePatch
): ChatStoreState {
  return { ...prev, ...patch };
}

