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
 * Acima desse intervalo SEM chegar nenhum byte, o servidor é considerado
 * emudecido e o stream é abortado. É teto de INATIVIDADE, não de duração
 * total — um stream lento porém vivo (comum nos modelos `:free` do
 * OpenRouter, onde a fila come tempo antes do primeiro token) não pode ser
 * punido por levar mais de 30s de relógio no total.
 */
const INACTIVITY_TIMEOUT_MS = 30_000;

/**
 * Streama a resposta em pedaços de texto. OpenRouter e NVIDIA NIM expõem o
 * mesmo `/chat/completions`, então o provider é só baseUrl + key + modelo.
 *
 * `inactivityTimeoutMs` só existe pra o teste conseguir usar um intervalo
 * curto contra um servidor local — em produção o parâmetro é sempre omitido.
 */
export async function* streamChat(
  messages: ChatMessage[],
  settings: Settings,
  signal: AbortSignal,
  inactivityTimeoutMs = INACTIVITY_TIMEOUT_MS,
): AsyncGenerator<string> {
  const provider = PROVIDERS[settings.provider];
  const key = settings.keys[settings.provider];
  if (!key) throw new MissingKeyError(settings.provider);

  // Combina o cancelamento vindo da UI com um timeout de INATIVIDADE: sem
  // isso, uma conexão que trava no meio do stream (wifi caindo) nunca chama
  // abort() e reader.read() fica pendurado pra sempre. O temporizador é
  // reiniciado a cada leitura que traz dado — só dispara quando o servidor
  // fica calado pelo intervalo inteiro.
  const silencio = new AbortController();
  const motivoSilencio = new DOMException("o servidor parou de responder", "TimeoutError");
  let timer = setTimeout(() => silencio.abort(motivoSilencio), inactivityTimeoutMs);
  const reiniciarTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => silencio.abort(motivoSilencio), inactivityTimeoutMs);
  };
  const combinedSignal = AbortSignal.any([signal, silencio.signal]);

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: combinedSignal,
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
      if (done) return;
      reiniciarTimer();

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
  } finally {
    // Sai pelo [DONE], pelo done do reader ou por exceção — em todo caso o
    // timer pendente precisa morrer junto, senão o silencio.abort() de um
    // stream que já terminou dispara em cima do nada.
    clearTimeout(timer);
  }
}
