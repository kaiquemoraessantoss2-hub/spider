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
  // Número do ciclo atual. terminar() zera gravacao.current assim que assume
  // uma gravação, então não tem mais como comparar promessa pra saber se
  // ainda é dono da tela quando sua transcrição volta — a geração resolve
  // isso pra qualquer ciclo (comecar() ou terminar()) que precise checar se
  // ainda é o mais recente antes de escrever estado de UI.
  const geracao = useRef(0);

  async function comecar() {
    if (gravacao.current) return;
    setAviso(null);
    const minha = ++geracao.current;
    const pendente = startRecording(setLevel);
    gravacao.current = pendente;
    setState("listening");
    try {
      await pendente;
    } catch (e) {
      // Um ciclo mais novo já pode ter assumido a tela — só limpamos o que
      // ainda é nosso, pra não pisar no estado de quem já tomou posse.
      if (geracao.current !== minha) return;
      gravacao.current = null;
      setState("idle");
      setLevel(0);
      setAviso(e instanceof Error ? e.message : "microfone indisponível");
    }
  }

  async function terminar() {
    const minha = geracao.current;
    const pendente = gravacao.current;
    if (!pendente) return;
    gravacao.current = null; // libera já: o próximo toque não fica travado
    setState("thinking");

    try {
      const gravador = await pendente; // espera o start terminar de abrir, qualquer que seja o tempo
      const audio = await gravador.stop(); // libera o microfone e fecha o AudioContext deste ciclo, sempre
      const texto = await transcribe(audio, loadSettings());
      if (texto) {
        window.dispatchEvent(new CustomEvent("spider:transcript", { detail: texto }));
      } else {
        setAviso("não entendi");
      }
    } catch (e) {
      // Idem: se um toque seguinte já começou outro ciclo (geracao.current
      // mudou), este terminar() é de um ciclo abandonado — não escreve um
      // aviso de erro falso por cima de uma gravação que está funcionando.
      if (geracao.current === minha) {
        setAviso(e instanceof Error ? e.message : "falha ao transcrever");
      }
    } finally {
      // Mesma guarda, só pra escrita de estado de UI — a limpeza de hardware
      // já aconteceu no stop() acima, incondicional, e não depende disto.
      if (geracao.current === minha) {
        setState("idle");
        setLevel(0);
      }
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
