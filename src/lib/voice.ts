import type { AsrProviderId, Settings } from "./settings.ts";

export interface Recording {
  stop(): Promise<Blob>;
}

// A base da NVIDIA não expõe rota de áudio (só chat/completions) — o ASR
// deles é Riva/gRPC, inacessível via fetch de um webview. Daí a transcrição
// ser de outro provedor, escolhido nas configurações.
/** Rótulo de cada provedor de transcrição, para a tela de configuração. */
export const ASR_PROVIDERS: Record<AsrProviderId, { label: string; ajuda: string }> = {
  openrouter: {
    label: "OpenRouter",
    ajuda: "mesma key do chat; o id do modelo é campo livre",
  },
  elevenlabs: {
    label: "ElevenLabs Scribe",
    ajuda: "key própria; transcreve português sem precisar escolher modelo",
  },
};

const OPENROUTER_ASR_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
const ELEVENLABS_ASR_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const ELEVENLABS_MODEL = "scribe_v1";

/** Nome do CustomEvent que carrega o texto transcrito até o ChatPanel. */
export const TRANSCRIPT_EVENT = "spider:transcript";

/**
 * Grava do microfone e reporta o nível de volume em tempo real (0..1) — é
 * isso que faz o anel do core respirar enquanto se fala.
 */
export async function startRecording(onLevel: (level: number) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const contexto = new AudioContext();
  let rodando = true;

  // Tudo daqui pra baixo pode falhar (MediaRecorder sem suporte ao mimeType,
  // por exemplo) depois que o microfone já foi aberto. Sem o try/catch, uma
  // falha aqui deixa a stream aberta, o AudioContext sem fechar e o loop de
  // medir() rodando pra sempre — ninguém chama stop() de um Recording que
  // nunca chegou a existir.
  try {
    const analisador = contexto.createAnalyser();
    analisador.fftSize = 256;
    contexto.createMediaStreamSource(stream).connect(analisador);

    const amostras = new Uint8Array(analisador.frequencyBinCount);

    function medir() {
      if (!rodando) return;
      analisador.getByteTimeDomainData(amostras);
      let soma = 0;
      for (const amostra of amostras) {
        const desvio = (amostra - 128) / 128;
        soma += desvio * desvio;
      }
      onLevel(Math.min(1, Math.sqrt(soma / amostras.length) * 4));
      requestAnimationFrame(medir);
    }
    medir();

    // Limpeza idempotente (guardada por `rodando`) — precisa rodar em toda
    // saída possível: onstop normal, onerror do recorder, e o caminho em que
    // o recorder já está inativo quando stop() é chamado.
    function liberar() {
      if (!rodando) return;
      rodando = false;
      onLevel(0);
      stream.getTracks().forEach((t) => t.stop());
      void contexto.close();
    }

    const gravador = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const pedacos: Blob[] = [];
    gravador.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    // Sem isso, um erro do recorder (dispositivo trocado/desconectado no meio
    // da gravação) deixa a stream aberta e o AudioContext nunca fecha.
    gravador.onerror = () => liberar();
    gravador.start();

    return {
      stop() {
        return new Promise<Blob>((resolve) => {
          // O Chromium inativa o recorder sozinho quando as tracks terminam
          // (fone desconectado, troca de dispositivo padrão do Windows). O
          // onstop automático disparou sem ninguém escutando — chamar
          // stop() de novo aqui lançaria InvalidStateError em vez de gerar
          // outro evento. Resolve direto com o que já foi gravado.
          if (gravador.state === "inactive") {
            liberar();
            resolve(new Blob(pedacos, { type: "audio/webm" }));
            return;
          }
          gravador.onstop = () => {
            liberar();
            resolve(new Blob(pedacos, { type: "audio/webm" }));
          };
          gravador.stop();
        });
      },
    };
  } catch (e) {
    rodando = false;
    stream.getTracks().forEach((t) => t.stop());
    void contexto.close();
    throw e;
  }
}

export async function transcribe(audio: Blob, settings: Settings): Promise<string> {
  const provedor = settings.asrProvider;
  const key = settings.asrKeys[provedor];
  if (!key) {
    throw new Error(`configure a key de ${ASR_PROVIDERS[provedor].label} para usar a voz`);
  }

  const form = new FormData();
  form.append("file", audio, "fala.webm");

  let url: string;
  let headers: Record<string, string>;

  if (provedor === "elevenlabs") {
    url = ELEVENLABS_ASR_URL;
    // A ElevenLabs autentica por header próprio, não por Bearer.
    headers = { "xi-api-key": key };
    form.append("model_id", ELEVENLABS_MODEL);
    // ISO-639-3. Dizer o idioma poupa a etapa de detecção e erra menos em
    // áudio curto, que é o caso de uso aqui (um comando de poucos segundos).
    form.append("language_code", "por");
  } else {
    url = OPENROUTER_ASR_URL;
    headers = { Authorization: `Bearer ${key}` };
    form.append("model", settings.asrModel);
  }

  const resposta = await fetch(url, { method: "POST", headers, body: form });

  if (!resposta.ok) {
    // O corpo do erro costuma dizer o que o provedor não aceitou (modelo
    // inexistente, cota estourada). Sem ele, o usuário só vê um número.
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(
      `transcrição falhou (${resposta.status})${detalhe ? `: ${detalhe.slice(0, 200)}` : ""}`,
    );
  }

  const { text } = (await resposta.json()) as { text?: string };
  return text?.trim() ?? "";
}

/** TTS nativa do WebView2 — nenhuma dependência, nenhuma chamada de rede. */
export function speak(texto: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const sintetizador = window.speechSynthesis;
  sintetizador.cancel();

  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";

  let jaFalou = false;
  const falar = () => {
    if (jaFalou) return;
    jaFalou = true;
    const voz = sintetizador.getVoices().find((v) => v.lang.startsWith("pt"));
    if (voz) fala.voice = voz;
    sintetizador.speak(fala);
  };

  // `getVoices()` devolve lista vazia na primeira chamada da página — as vozes
  // carregam de forma assíncrona e só então `voiceschanged` dispara. Falar
  // nesse instante deixaria `voice` nulo e leria português com a voz padrão do
  // sistema, que aqui é en-US. O timer é a rede de segurança: se o evento não
  // vier, falamos mesmo assim em vez de ficar mudos para sempre.
  if (sintetizador.getVoices().length === 0) {
    sintetizador.addEventListener("voiceschanged", falar, { once: true });
    setTimeout(falar, 250);
  } else {
    falar();
  }
}

/** Interrompe qualquer fala em andamento — o componente não fala com a API do navegador direto. */
export function calar(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
