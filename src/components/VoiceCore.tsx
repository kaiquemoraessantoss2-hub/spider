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
  const gravacao = useRef<Recording | null>(null);

  async function comecar() {
    if (gravacao.current) return;
    setAviso(null);
    try {
      gravacao.current = await startRecording(setLevel);
      setState("listening");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "microfone indisponível");
    }
  }

  async function terminar() {
    const atual = gravacao.current;
    if (!atual) return;
    gravacao.current = null;
    setState("thinking");

    try {
      const audio = await atual.stop();
      const texto = await transcribe(audio, loadSettings());
      if (texto) {
        window.dispatchEvent(new CustomEvent("spider:transcript", { detail: texto }));
      } else {
        setAviso("não entendi");
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "falha ao transcrever");
    } finally {
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
