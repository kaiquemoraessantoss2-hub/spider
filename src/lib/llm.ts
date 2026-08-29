import { SSEBuffer } from "./sse.ts";
import type { ProviderId, Settings } from "./settings.ts";

export interface ProviderConfig {
  label: string;
  baseUrl: string;
  /**
   * Modelos gratuitos conhecidos. Lista curada à mão de propósito —
   * descoberta dinâmica de catálogo não vale a complexidade aqui.
   */
  models: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "deepseek/deepseek-chat-v3.1:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-235b-a22b:free",
      "google/gemma-3-27b-it:free",
    ],
  },
  nvidia: {
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    models: [
      "meta/llama-3.3-70b-instruct",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-coder-32b-instruct",
    ],
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MissingKeyError extends Error {
  constructor(provider: ProviderId) {
    super(`configure a key de ${PROVIDERS[provider].label} nas configurações`);
    this.name = "MissingKeyError";
  }
}

/**
 * Streama a resposta em pedaços de texto. OpenRouter e NVIDIA NIM expõem o
 * mesmo `/chat/completions`, então o provider é só baseUrl + key + modelo.
 */
export async function* streamChat(
  messages: ChatMessage[],
  settings: Settings,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const provider = PROVIDERS[settings.provider];
  const key = settings.keys[settings.provider];
  if (!key) throw new MissingKeyError(settings.provider);

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: settings.model, messages, stream: true }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `${provider.label} respondeu ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
  if (!response.body) throw new Error("resposta sem corpo");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const buffer = new SSEBuffer();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const payload of buffer.push(decoder.decode(value, { stream: true }))) {
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Payload que não é JSON válido (keep-alive de proxy, por exemplo).
        // Ignorar é correto: perder um chunk decorativo é melhor do que
        // derrubar a conversa inteira.
      }
    }
  }
}
