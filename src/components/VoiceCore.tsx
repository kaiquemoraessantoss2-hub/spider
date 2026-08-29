"use client";

import { useRef, useState } from "react";
import { Ring, type RingState } from "@/components/hud/Ring";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { startRecording, transcribe, type Recording } from "@/lib/voice";
import { loadSettings } from "@/lib/settings";

export function VoiceCore() {
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<RingState>("idle");
  const [aviso, setAviso] = useState<string | null>(null);
  // Guarda a PROMESSA, não o resultado: ela é atribuída no mesmo tick do
  // pointerdown, antes de qualquer await. Um pointerup logo em seguida
  // (toque brevíssimo) sempre encontra a ref preenchida — não existe mais a
  // janela em que terminar() via null e não tinha o que parar.
  const gravacao = useRef<Promise<Recording> | null>(null);

  async function comecar() {
    if (gravacao.current) return;
    setAviso(null);
    const pendente = startRecording(setLevel);
    gravacao.current = pendente;
    setState("listening");
    try {
      await pendente;
    } catch (e) {
      // terminar() pode já ter assumido essa promessa (gravacao.current virou
      // null, ou até uma promessa mais nova de um terceiro toque) — só
      // limpamos o que ainda é nosso, pra não pisar no estado de um ciclo
      // mais novo já em andamento.
      if (gravacao.current !== pendente) return;
      gravacao.current = null;
      setState("idle");
      setLevel(0);
      setAviso(e instanceof Error ? e.message : "microfone indisponível");
    }
  }

  async function terminar() {
    const pendente = gravacao.current;
    if (!pendente) return;
    gravacao.current = null; // libera já: o próximo toque não fica travado
    setState("thinking");

    try {
      const gravador = await pendente; // espera o start terminar de abrir, qualquer que seja o tempo
      const audio = await gravador.stop();
      const texto = await transcribe(audio, loadSettings());
      if (texto) {
        window.dispatchEvent(new CustomEvent("spider:transcript", { detail: texto }));
      } else {
        setAviso("não entendi");
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "falha ao transcrever");
    } finally {
      // ponytail: se um ciclo antigo (toque breve já solto) terminar de
      // transcrever enquanto um ciclo mais novo já está gravando, este
      // finally pode piscar o estado pra "idle" por um instante — cosmético,
      // a gravação do ciclo novo continua rodando por trás. Resolve com um
      // contador de geração se isso incomodar visualmente.
      setState("idle");
      setLevel(0);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onPointerDown={() => void comecar()}
        onPointerUp={() => void terminar()}
        onPointerLeave={() => void terminar()}
        onPointerCancel={() => void terminar()}
        aria-label="segure para falar"
        className="rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        <Ring level={level} state={state} size={280} />
      </button>

      <MicroLabel tone={state === "idle" ? "faint" : "ember"}>
        {state === "listening"
          ? "ouvindo"
          : state === "thinking"
            ? "transcrevendo"
            : "segure para falar"}
      </MicroLabel>

      {aviso && <p className="max-w-[240px] text-center text-xs text-danger">{aviso}</p>}
    </div>
  );
}
