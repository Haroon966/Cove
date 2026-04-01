/**
 * Non-streaming chat completion: Ollama or OpenAI-compatible.
 * Reuses same request shape as Cove frontend.
 */
import { getEffectiveBaseUrl, getEffectiveApiKey } from "./config.js";

export async function chatCompletion(config, userMessage) {
  const baseUrl = getEffectiveBaseUrl(config);
  const apiKey = getEffectiveApiKey(config);
  const model = config?.model?.trim() || "llama3.2";
  const systemPrompt = config?.system_prompt?.trim() || null;
  const temperature = config?.temperature ?? 0.7;
  const maxTokens = config?.max_tokens ?? 2048;
  const backendType = config?.backend_type ?? "ollama";

  if (!baseUrl) {
    throw new Error("No base URL configured. Set AI provider in Cove Settings.");
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userMessage });

  if (backendType === "ollama") {
    return ollamaChat(baseUrl, model, messages, temperature, maxTokens);
  }
  return openAIChat(baseUrl, model, messages, apiKey, temperature, maxTokens);
}

async function ollamaChat(baseUrl, model, messages, temperature, maxTokens) {
  const url = baseUrl.replace(/\/$/, "") + "/api/chat";
  const body = {
    model,
    messages,
    stream: false,
    options: {},
  };
  if (temperature != null) body.options.temperature = temperature;
  if (maxTokens != null) body.options.num_predict = maxTokens;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ollama HTTP ${res.status}`);
  }
  const data = await res.json();
  const content = data.message?.content;
  if (content == null) throw new Error("No message content in Ollama response");
  return content;
}

async function openAIChat(baseUrl, model, messages, apiKey, temperature, maxTokens) {
  const url = baseUrl.replace(/\/$/, "") + "/v1/chat/completions";
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages,
    stream: false,
    ...(temperature != null && { temperature }),
    ...(maxTokens != null && { max_tokens: maxTokens }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `OpenAI HTTP ${res.status}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null) throw new Error("No message content in OpenAI response");
  return content;
}
