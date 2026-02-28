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
  /** Legacy: used for custom OpenAI-compatible backend. */
  api_key: string | null;
  /** Named API keys per provider: openai, gemini, groq, etc. */
  api_keys?: Record<string, string> | null;
  system_prompt?: string | null;
  theme?: string | null;
  primary_color?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
}

export type BackendType = "ollama" | "openai" | "groq" | "openai_compatible";

export interface TextAttachment {
  type: "text";
  name: string;
  content: string;
}

export interface ImageAttachment {
  type: "image";
  name: string;
  dataBase64: string;
  mimeType: string;
}

export type Attachment = TextAttachment | ImageAttachment;
