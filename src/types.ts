export interface Session {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  model: string | null;
  backend_type: string | null;
}

export interface Message {
  id: number;
  session_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: number;
}

export interface SearchResult {
  session_id: number;
  title: string;
  snippet: string;
}

export interface AppConfig {
  backend_type: string | null;
  base_url: string | null;
  model: string | null;
  api_key: string | null;
  system_prompt?: string | null;
  theme?: string | null;
  primary_color?: string | null;
}

export type BackendType = "ollama" | "openai";
