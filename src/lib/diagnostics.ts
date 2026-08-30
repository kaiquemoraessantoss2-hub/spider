import { PROVIDERS } from "./llm.ts";
import { ASR_PROVIDERS } from "./voice.ts";
import type { Settings } from "./settings.ts";

export interface Diagnostico {
  alvo: string;
  ok: boolean;
  detalhe: string;
}

/**
 * Meio segundo de tom puro em WAV 8kHz mono. Serve de áudio de teste para o
 * ASR sem precisar do microfone: os provedores exigem um arquivo com alguma
 * duração real (a ElevenLabs recusa abaixo de 100ms), e o que interessa aqui
 * não é o que ele transcreve — é se a key, a rota e o modelo respondem.
 */
function wavDeTeste(): Blob {
  const taxa = 8000;
  const amostras = taxa / 2;
  const buffer = new ArrayBuffer(44 + amostras * 2);
  const v = new DataView(buffer);

  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };

  texto(0, "RIFF");
  v.setUint32(4, 36 + amostras * 2, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // alinhamento de bloco
  v.setUint16(34, 16, true); // bits por amostra
  texto(36, "data");
  v.setUint32(40, amostras * 2, true);

  for (let i = 0; i < amostras; i++) {
    v.setInt16(44 + i * 2, Math.round(Math.sin((i / taxa) * 440 * 2 * Math.PI) * 8000), true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function resumo(resposta: Response): Promise<string> {
  const corpo = await resposta.text().catch(() => "");
  return `${resposta.status} ${corpo.slice(0, 180)}`.trim();
}

/** Uma requisição mínima ao endpoint de chat — sem streaming, 1 token. */
export async function testarChat(settings: Settings): Promise<Diagnostico> {
  const provider = PROVIDERS[settings.provider];
  const alvo = `chat · ${provider.label} · ${settings.model}`;
  const key = settings.keys[settings.provider];
  if (!key) return { alvo, ok: false, detalhe: "sem key configurada" };

  try {
    const r = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
      }),
    });
    return { alvo, ok: r.ok, detalhe: await resumo(r) };
  } catch (e) {
    // Erro de rede não chega como status: sem isso, uma falha de DNS ou de
    // CORS apareceria como "undefined" na tela.
    return { alvo, ok: false, detalhe: e instanceof Error ? e.message : String(e) };
  }
}

/** Manda meio segundo de tom para o ASR configurado. */
export async function testarTranscricao(settings: Settings): Promise<Diagnostico> {
  const provedor = settings.asrProvider;
  const alvo = `voz · ${ASR_PROVIDERS[provedor].label}`;
  const key = settings.asrKeys[provedor];
  if (!key) return { alvo, ok: false, detalhe: "sem key configurada" };

  const form = new FormData();
  form.append("file", wavDeTeste(), "teste.wav");

  let url: string;
  let headers: Record<string, string>;
  if (provedor === "elevenlabs") {
    url = "https://api.elevenlabs.io/v1/speech-to-text";
    headers = { "xi-api-key": key };
    form.append("model_id", "scribe_v2");
  } else {
    url = "https://openrouter.ai/api/v1/audio/transcriptions";
    headers = { Authorization: `Bearer ${key}` };
    form.append("model", settings.asrModel);
  }

  try {
    const r = await fetch(url, { method: "POST", headers, body: form });
    return { alvo, ok: r.ok, detalhe: await resumo(r) };
  } catch (e) {
    return { alvo, ok: false, detalhe: e instanceof Error ? e.message : String(e) };
  }
}

/** Vozes de síntese que o webview enxerga — o TTS não depende de rede. */
export function testarFala(): Diagnostico {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return { alvo: "fala · sistema", ok: false, detalhe: "speechSynthesis indisponível" };
  }
  const vozes = window.speechSynthesis.getVoices();
  const pt = vozes.filter((v) => v.lang.startsWith("pt"));
  return {
    alvo: "fala · sistema",
    ok: pt.length > 0,
    detalhe: pt.length
      ? `${pt.map((v) => v.name).join(", ")}`
      : `nenhuma voz pt entre ${vozes.length} instaladas`,
  };
}

export async function testarTudo(settings: Settings): Promise<Diagnostico[]> {
  const [chat, voz] = await Promise.all([testarChat(settings), testarTranscricao(settings)]);
  return [chat, voz, testarFala()];
}
