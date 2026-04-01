import { invoke } from "../../api/tauri";

export interface KnowledgeDoc {
  id: number;
  title: string;
  source_path?: string | null;
  mime_type?: string | null;
  content: string;
  chunk_count: number;
  created_at: number;
  updated_at: number;
}

export interface KnowledgeSnippet {
  doc_id: number;
  doc_title: string;
  chunk_index: number;
  snippet: string;
  score: number;
}

export async function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  return invoke<KnowledgeDoc[]>("knowledge_doc_list");
}

export async function createKnowledgeDoc(input: {
  title: string;
  sourcePath?: string | null;
  mimeType?: string | null;
  content: string;
  chunkCount?: number;
}): Promise<number> {
  return invoke<number>("knowledge_doc_create", {
    title: input.title,
    source_path: input.sourcePath ?? null,
    mime_type: input.mimeType ?? null,
    content: input.content,
    chunk_count: input.chunkCount ?? 0,
  });
}

export async function deleteKnowledgeDoc(docId: number): Promise<void> {
  await invoke("knowledge_doc_delete", { doc_id: docId });
}

export async function retrieveKnowledge(
  query: string,
  options?: { limit?: number; sessionId?: number | null }
): Promise<KnowledgeSnippet[]> {
  return invoke<KnowledgeSnippet[]>("knowledge_retrieve", {
    query,
    limit: options?.limit ?? 6,
    session_id: options?.sessionId ?? null,
  });
}

export async function listSessionKnowledgeSources(sessionId: number): Promise<number[]> {
  return invoke<number[]>("knowledge_session_sources_list", { session_id: sessionId });
}

export async function setSessionKnowledgeSources(
  sessionId: number,
  docIds: number[]
): Promise<void> {
  await invoke("knowledge_session_sources_set", {
    session_id: sessionId,
    doc_ids: docIds,
  });
}

