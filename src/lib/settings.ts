export type ProviderId = "openrouter" | "nvidia";

export interface Settings {
  provider: ProviderId;
  model: string;
  /** Uma key por provider — trocar de provider não apaga a outra. */
  keys: Record<ProviderId, string>;
}

const STORAGE_KEY = "spider.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  model: "deepseek/deepseek-chat-v3.1:free",
  keys: { openrouter: "", nvidia: "" },
};

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
      provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
      model: parsed.model ?? DEFAULT_SETTINGS.model,
      keys: { ...DEFAULT_SETTINGS.keys, ...parsed.keys },
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
