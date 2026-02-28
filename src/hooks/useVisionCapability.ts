import { useState, useEffect, useCallback } from "react";
import type { AppConfig } from "../types";
import { fetchOllamaModelShow } from "../api/ollama";
import { isOpenAIVisionModel } from "../visionModels";

const visionCache = new Map<string, boolean>();

function cacheKey(baseUrl: string, model: string): string {
  return `${baseUrl}\0${model}`;
}

export function useVisionCapability(
  config: AppConfig | null,
  currentModel: string | null
): { supportsVision: boolean; loading: boolean } {
  const [supportsVision, setSupportsVision] = useState(false);
  const [loading, setLoading] = useState(false);

  const backend = config?.backend_type ?? "ollama";
  const baseUrl = config?.backend_type === "ollama" ? config?.base_url?.trim() ?? "" : null;

  const checkOllama = useCallback(async (url: string, model: string, signal: AbortSignal) => {
    const key = cacheKey(url, model);
    const cached = visionCache.get(key);
    if (cached !== undefined) {
      setSupportsVision(cached);
      setLoading(false);
      return;
    }
    try {
      const hasVision = await fetchOllamaModelShow(url, model, signal);
      visionCache.set(key, hasVision);
      if (!signal.aborted) setSupportsVision(hasVision);
    } catch {
      if (!signal.aborted) setSupportsVision(false);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentModel?.trim()) {
      setSupportsVision(false);
      setLoading(false);
      return;
    }
    if (backend !== "ollama") {
      setSupportsVision(isOpenAIVisionModel(currentModel));
      setLoading(false);
      return;
    }
    if (!baseUrl) {
      setSupportsVision(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const url = baseUrl.replace(/\/$/, "");
    checkOllama(url, currentModel.trim(), controller.signal);
    return () => controller.abort();
  }, [backend, baseUrl, currentModel, checkOllama]);

  return { supportsVision, loading };
}
