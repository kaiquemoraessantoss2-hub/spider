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

/**
 * Grava do microfone e reporta o nível de volume em tempo real (0..1) — é
 * isso que faz o anel do core respirar enquanto se fala.
 */
export async function startRecording(onLevel: (level: number) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const contexto = new AudioContext();
  const analisador = contexto.createAnalyser();
  analisador.fftSize = 256;
  contexto.createMediaStreamSource(stream).connect(analisador);

  const amostras = new Uint8Array(analisador.frequencyBinCount);
  let rodando = true;

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

  const gravador = new MediaRecorder(stream, { mimeType: "audio/webm" });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size > 0) pedacos.push(e.data);
  };
  gravador.start();

  return {
    stop() {
      return new Promise<Blob>((resolve) => {
        gravador.onstop = () => {
          rodando = false;
          onLevel(0);
          stream.getTracks().forEach((t) => t.stop());
          void contexto.close();
          resolve(new Blob(pedacos, { type: "audio/webm" }));
        };
        gravador.stop();
      });
    },
  };
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
