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
  /** Voz da ElevenLabs usada para falar as respostas. Vazio = usa direto a
   *  voz do sistema, sem gastar crédito. */
  elevenVoiceId: string;
  /** Pasta que contém uma subpasta por cliente. Escolhida pelo seletor
   *  nativo do sistema; vazia significa cair na variável de ambiente. */
  projectsRoot: string;
  /** Id do modelo de transcrição no OpenRouter. Campo livre: o catálogo de
   *  STT só aparece filtrando `?output_modalities=transcription`, então
   *  sugerimos alguns e deixamos o resto por conta de quem quiser trocar. */
  asrModel: string;
}

const STORAGE_KEY = "spider.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  model: "openrouter/free",
  keys: { openrouter: "", nvidia: "" },
  asrProvider: "elevenlabs",
  asrKeys: { openrouter: "", elevenlabs: "" },
  asrModel: "openai/whisper-large-v3-turbo",
  elevenVoiceId: "",
  projectsRoot: "",
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
      // O padrão antigo saiu do catálogo do OpenRouter e passou a responder
      // 404. Quem tinha ele salvo volta para o roteador de gratuitos em vez
      // de descobrir sozinho que o modelo morreu.
      model:
        !parsed.model || parsed.model === "deepseek/deepseek-chat-v3.1:free"
          ? DEFAULT_SETTINGS.model
          : parsed.model,
      keys: { ...DEFAULT_SETTINGS.keys, ...parsed.keys },
      asrProvider: isAsrProviderId(parsed.asrProvider)
        ? parsed.asrProvider
        : DEFAULT_SETTINGS.asrProvider,
      asrKeys: { ...DEFAULT_SETTINGS.asrKeys, ...parsed.asrKeys },
      // "deepgram/flux" foi um padrão errado de uma versão anterior: é modelo
      // de SÍNTESE de fala, e a rota de transcrição responde 400 com ele.
      // Quem já salvou esse valor volta pro padrão em vez de ficar quebrado.
      elevenVoiceId: parsed.elevenVoiceId ?? DEFAULT_SETTINGS.elevenVoiceId,
      projectsRoot: parsed.projectsRoot ?? DEFAULT_SETTINGS.projectsRoot,
      asrModel:
        !parsed.asrModel || parsed.asrModel === "deepgram/flux"
          ? DEFAULT_SETTINGS.asrModel
          : parsed.asrModel,
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

const CONVERSA_KEY = "spider.conversa.v1";
/** Teto de mensagens guardadas. O histórico inteiro é reenviado a cada turno,
 *  então deixá-lo crescer sem limite estoura o contexto dos modelos gratuitos
 *  antes de encher o localStorage. */
const MAX_MENSAGENS = 40;

export interface MensagemSalva {
  role: "system" | "user" | "assistant";
  content: string;
}

export function carregarConversa(): MensagemSalva[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONVERSA_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is MensagemSalva =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as MensagemSalva).content === "string" &&
        ["system", "user", "assistant"].includes((m as MensagemSalva).role),
    );
  } catch {
    return [];
  }
}

export function salvarConversa(mensagens: MensagemSalva[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONVERSA_KEY,
      JSON.stringify(mensagens.slice(-MAX_MENSAGENS)),
    );
  } catch {
    // Cota estourada ou storage bloqueado: perder o histórico é melhor do
    // que derrubar a conversa em andamento.
  }
}
