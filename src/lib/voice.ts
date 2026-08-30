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
    ajuda: "mesma key do chat, mas transcrição no OpenRouter é paga (nenhum modelo :free)",
  },
  elevenlabs: {
    label: "ElevenLabs Scribe",
    ajuda: "key própria; transcreve português sem precisar escolher modelo",
  },
};

const OPENROUTER_ASR_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
const ELEVENLABS_ASR_URL = "https://api.elevenlabs.io/v1/speech-to-text";
// A doc atual só documenta scribe_v2; contas antigas ainda aceitam scribe_v1.
// Tentamos o novo e caímos no antigo se o provedor recusar o id — evita que
// a voz morra por causa de um nome de modelo, que é justamente o erro que já
// nos custou duas idas e vindas.
const ELEVENLABS_MODELS = ["scribe_v2", "scribe_v1"];

/** Sugestões de STT do OpenRouter, das mais baratas às mais caras. A lista
 *  completa sai de `/api/v1/models?output_modalities=transcription` — todos
 *  são pagos, o que é justamente a razão do ElevenLabs ser o padrão. */
export const OPENROUTER_ASR_MODELS = [
  "openai/gpt-4o-mini-transcribe",
  "openai/whisper-large-v3-turbo",
  "qwen/qwen3-asr-0.6b",
  "nvidia/parakeet-tdt-0.6b-v3",
  "deepgram/nova-3",
];

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

async function pedirTranscricao(
  url: string,
  headers: Record<string, string>,
  campos: Record<string, string>,
  audio: Blob,
): Promise<Response> {
  const form = new FormData();
  form.append("file", audio, "fala.webm");
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  return fetch(url, { method: "POST", headers, body: form });
}

export async function transcribe(audio: Blob, settings: Settings): Promise<string> {
  const provedor = settings.asrProvider;
  const key = settings.asrKeys[provedor];
  if (!key) {
    throw new Error(`configure a key de ${ASR_PROVIDERS[provedor].label} para usar a voz`);
  }

  let resposta: Response;

  if (provedor === "elevenlabs") {
    // A ElevenLabs autentica por header próprio, não por Bearer. O
    // language_code em ISO-639-3 poupa a detecção de idioma e erra menos em
    // áudio curto, que é o caso aqui (um comando de poucos segundos).
    const headers = { "xi-api-key": key };
    resposta = await pedirTranscricao(ELEVENLABS_ASR_URL, headers, {
      model_id: ELEVENLABS_MODELS[0]!,
      language_code: "por",
    }, audio);

    if (!resposta.ok && resposta.status < 500) {
      const corpo = await resposta.clone().text().catch(() => "");
      if (/model/i.test(corpo)) {
        resposta = await pedirTranscricao(ELEVENLABS_ASR_URL, headers, {
          model_id: ELEVENLABS_MODELS[1]!,
          language_code: "por",
        }, audio);
      }
    }
  } else {
    resposta = await pedirTranscricao(
      OPENROUTER_ASR_URL,
      { Authorization: `Bearer ${key}` },
      { model: settings.asrModel },
      audio,
    );
  }

  if (!resposta.ok) {
    // 402 no OpenRouter é sempre a mesma história: transcrição lá é paga e
    // nenhum modelo é :free. Dizer isso é mais útil do que repassar o JSON.
    if (provedor === "openrouter" && resposta.status === 402) {
      throw new Error(
        "o OpenRouter cobra por transcrição e exige saldo. Troque \"quem transcreve a fala\" para ElevenLabs nas configurações, ou adicione crédito.",
      );
    }
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

/** TTS nativa do WebView2 — sem dependência, sem rede, sem cota. É o piso:
 *  quando a nuvem falha por qualquer motivo, a resposta ainda é falada. */
export function falarComOSistema(texto: string): void {
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

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
/** Turbo custa metade dos créditos do multilingual v2 e fala português. */
const ELEVENLABS_TTS_MODEL = "eleven_turbo_v2_5";

let audioAtual: HTMLAudioElement | null = null;

/** Vozes da conta, para o seletor das configurações. */
export async function listarVozesElevenLabs(key: string): Promise<{ id: string; nome: string }[]> {
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
    if (!r.ok) return [];
    const { voices } = (await r.json()) as { voices?: { voice_id: string; name: string }[] };
    return (voices ?? []).map((v) => ({ id: v.voice_id, nome: v.name }));
  } catch {
    return [];
  }
}

async function falarComElevenLabs(texto: string, settings: Settings): Promise<void> {
  const key = settings.asrKeys.elevenlabs;
  if (!key || !settings.elevenVoiceId) throw new Error("ElevenLabs não configurada");

  const r = await fetch(`${ELEVENLABS_TTS_URL}/${settings.elevenVoiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto, model_id: ELEVENLABS_TTS_MODEL }),
  });

  // Cota estourada (401/402/429) cai aqui junto com qualquer outra falha — e
  // é exatamente o caso em que queremos a voz do sistema, não um erro.
  if (!r.ok) throw new Error(`ElevenLabs respondeu ${r.status}`);

  const url = URL.createObjectURL(await r.blob());
  const audio = new Audio(url);
  audioAtual = audio;
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}

/**
 * Fala a resposta. Tenta a ElevenLabs quando há key e voz escolhidas, e cai
 * na voz do sistema em QUALQUER falha — cota acabada, key inválida, internet
 * fora. Voz pior é melhor que silêncio.
 *
 * Devolve qual caminho falou, para a tela poder avisar que a cota acabou.
 */
export async function speak(texto: string, settings?: Settings): Promise<"elevenlabs" | "sistema"> {
  calar();

  if (settings?.asrKeys.elevenlabs && settings.elevenVoiceId) {
    try {
      await falarComElevenLabs(texto, settings);
      return "elevenlabs";
    } catch {
      // cai para o sistema logo abaixo
    }
  }

  falarComOSistema(texto);
  return "sistema";
}

/** Interrompe qualquer fala em andamento — o componente não fala com a API do navegador direto. */
export function calar(): void {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  // A fala da nuvem toca por um <audio>, que o speechSynthesis não conhece —
  // sem parar os dois, "calar" silenciava só metade das vozes possíveis.
  if (audioAtual) {
    audioAtual.pause();
    audioAtual = null;
  }
}
