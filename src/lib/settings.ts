import { PROVIDERS } from "./llm.ts";

export type ProviderId = "openrouter" | "nvidia";

/** Provedores de transcrição (voz). Separados dos de chat porque a
 *  autenticação difere: OpenRouter usa Bearer, ElevenLabs usa xi-api-key. */
export type AsrProviderId = "openrouter" | "elevenlabs";

export interface Settings {
  provider: ProviderId;
  model: string;
  /** Uma key por provider — trocar de provider não apaga a outra. */
  keys: Record<ProviderId, string>;
  /** Quem transcreve a fala. */
  asrProvider: AsrProviderId;
  /** Uma key por provedor de transcrição, pela mesma razão das de chat. */
  asrKeys: Record<AsrProviderId, string>;
  /** Id do modelo de transcrição no OpenRouter. É campo livre porque o
   *  catálogo de áudio deles não aparece na listagem pública de modelos. */
  asrModel: string;
}

const STORAGE_KEY = "spider.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  model: "deepseek/deepseek-chat-v3.1:free",
  keys: { openrouter: "", nvidia: "" },
  asrProvider: "elevenlabs",
  asrKeys: { openrouter: "", elevenlabs: "" },
  asrModel: "deepgram/flux",
};

/** JSON.parse não garante que o valor bata com o enum — localStorage pode
 * ter sido escrito por uma versão antiga/futura do app. */
function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}

function isAsrProviderId(value: unknown): value is AsrProviderId {
  return value === "openrouter" || value === "elevenlabs";
}

/**
 * A key vive em texto puro no localStorage do WebView2 (%LOCALAPPDATA%).
 * Decisão consciente do spec: app local, single-user, key de tier gratuito.
 * Se virar key paga, este arquivo é o único ponto a migrar para o
 * Credential Manager do Windows.
 */
export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      provider: isProviderId(parsed.provider) ? parsed.provider : DEFAULT_SETTINGS.provider,
      model: parsed.model ?? DEFAULT_SETTINGS.model,
      keys: { ...DEFAULT_SETTINGS.keys, ...parsed.keys },
      asrProvider: isAsrProviderId(parsed.asrProvider)
        ? parsed.asrProvider
        : DEFAULT_SETTINGS.asrProvider,
      asrKeys: { ...DEFAULT_SETTINGS.asrKeys, ...parsed.asrKeys },
      asrModel: parsed.asrModel ?? DEFAULT_SETTINGS.asrModel,
    };
  } catch {
    // localStorage indisponível ou JSON corrompido: seguir com o padrão é
    // melhor do que derrubar a tela inteira por causa de configuração.
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sem espaço ou storage bloqueado: a sessão atual continua funcionando
    // com o valor em memória.
  }
}
