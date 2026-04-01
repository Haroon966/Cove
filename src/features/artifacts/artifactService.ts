import { invoke } from "../../api/tauri";
import type { Artifact } from "../../types";

export async function listArtifacts(sessionId: number): Promise<Artifact[]> {
  return invoke<Artifact[]>("artifact_list", { session_id: sessionId });
}

export async function createArtifact(input: {
  sessionId: number;
  messageId?: number | null;
  artifactType: string;
  title?: string | null;
  payload: string;
}): Promise<number> {
  return invoke<number>("artifact_create", {
    session_id: input.sessionId,
    message_id: input.messageId ?? null,
    artifact_type: input.artifactType,
    title: input.title ?? null,
    payload: input.payload,
  });
}

export async function updateArtifact(
  artifactId: number,
  updates: { title?: string | null; payload?: string | null }
): Promise<void> {
  await invoke("artifact_update", {
    artifact_id: artifactId,
    title: updates.title ?? null,
    payload: updates.payload ?? null,
  });
}

export async function deleteArtifact(artifactId: number): Promise<void> {
  await invoke("artifact_delete", { artifact_id: artifactId });
}

