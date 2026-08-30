import type { Settings } from "./settings.ts";

export interface Recording {
  stop(): Promise<Blob>;
}

// A base da NVIDIA não expõe rota de áudio (só chat/completions) — o ASR
// deles é Riva/gRPC, inacessível via fetch de um webview. Por isso o ASR usa
// Groq Whisper, o fallback já previsto pelo plano, no mesmo formato
// multipart. Ver task-9-report.md para o histórico da verificação.
const ASR_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const ASR_MODEL = "whisper-large-v3-turbo";

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
  const key = settings.groqKey;
  if (!key) throw new Error("configure a key do Groq para usar a voz");

  const form = new FormData();
  form.append("file", audio, "fala.webm");
  form.append("model", ASR_MODEL);

  const resposta = await fetch(ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!resposta.ok) throw new Error(`transcrição falhou (${resposta.status})`);

  const { text } = (await resposta.json()) as { text?: string };
  return text?.trim() ?? "";
}

/** TTS nativa do WebView2 — nenhuma dependência, nenhuma chamada de rede. */
export function speak(texto: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  const vozPtBr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("pt"));
  if (vozPtBr) fala.voice = vozPtBr;
  window.speechSynthesis.speak(fala);
}

/** Interrompe qualquer fala em andamento — o componente não fala com a API do navegador direto. */
export function calar(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
