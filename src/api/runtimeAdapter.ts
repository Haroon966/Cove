import type { AppConfig, Message } from "../types";

export interface RuntimeAdapterOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  lastMessageImages?: { base64: string; mimeType?: string }[];
}

export interface RuntimeAdapter {
  id: string;
  streamChat: (
    baseUrl: string,
    model: string,
    messages: Message[],
    config: AppConfig,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (error: Error) => void,
    options?: RuntimeAdapterOptions
  ) => Promise<void>;
}

