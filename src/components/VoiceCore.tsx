"use client";

import { useEffect, useRef, useState } from "react";
import { Ring, type RingState } from "@/components/hud/Ring";
import { MicroLabel } from "@/components/hud/MicroLabel";
import {
  startRecording,
  transcribe,
  TRANSCRIPT_EVENT,
  STREAMING_EVENT,
  type Recording,
} from "@/lib/voice";
import { loadSettings } from "@/lib/settings";

export function VoiceCore({ size = 280 }: { size?: number }) {
  // Abaixo de 1100px o core reaparece pequeno no header (I3): sem espaço
  // pra label nem aviso, só o anel — o botão continua com aria-label.
  const compacto = size < 100;
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
  const [respondendo, setRespondendo] = useState(false);
  const [inclinacao, setInclinacao] = useState({ x: 0, y: 0 });

  // O core pulsa enquanto a resposta é escrita. Sem isso, o único sinal de
  // que ele está trabalhando é o cursor piscando lá no painel de texto.
  useEffect(() => {
    function ouvir(e: Event) {
      setRespondendo(Boolean((e as CustomEvent<boolean>).detail));
    }
    window.addEventListener(STREAMING_EVENT, ouvir);
    return () => window.removeEventListener(STREAMING_EVENT, ouvir);
  }, []);

  // Inclinação sutil seguindo o ponteiro: é o que faz o anel parecer um
  // objeto num espaço, e não um desenho colado na tela. Amplitude pequena de
  // propósito — passando de ~8 graus vira enjoo, não profundidade.
  useEffect(() => {
    if (compacto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function mover(e: PointerEvent) {
      setInclinacao({
        x: (e.clientY / window.innerHeight - 0.5) * -8,
        y: (e.clientX / window.innerWidth - 0.5) * 8,
      });
    }
    window.addEventListener("pointermove", mover);
    return () => window.removeEventListener("pointermove", mover);
  }, [compacto]);

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
        window.dispatchEvent(new CustomEvent(TRANSCRIPT_EVENT, { detail: texto }));
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
    <div className={compacto ? "flex items-center" : "flex flex-col items-center gap-4"}>
      <button
        type="button"
        onPointerDown={() => void comecar()}
        onPointerUp={() => void terminar()}
        onPointerLeave={() => void terminar()}
        onPointerCancel={() => void terminar()}
        onKeyDown={(e) => {
          // event.repeat dispara em rajada enquanto a tecla fica pressionada
          // — sem a guarda, cada repetição tentaria abrir uma nova gravação.
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            void comecar();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            void terminar();
          }
        }}
        // Alt+Tab segurando o Espaço nunca dispara keyup — sem isso a
        // gravação fica aberta com a janela em segundo plano.
        onBlur={() => void terminar()}
        aria-label={aviso ? `segure para falar — ${aviso}` : "segure para falar"}
        title={aviso ?? undefined}
        className="relative rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        <div
          style={{
            // A perspectiva mora no filho e não no pai porque o pai é um
            // botão: aplicar transform 3D nele quebraria o anel de foco.
            perspective: 900,
            transform: `rotateX(${inclinacao.x}deg) rotateY(${inclinacao.y}deg)`,
            transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            transformStyle: "preserve-3d",
          }}
        >
          <Ring level={level} state={state === "idle" && respondendo ? "thinking" : state} size={size} />
        </div>
        {/* No core compacto do header (960–1099px) a label e o parágrafo de
            aviso somem — sem isso uma falha de microfone não dava feedback
            nenhum. O title/aria-label acima cobre teclado e leitor de tela;
            este ponto cobre o feedback visual sem alterar a largura do header. */}
        {compacto && aviso && (
          <span
            className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-danger"
            aria-hidden
          />
        )}
      </button>

      {!compacto && (
        <MicroLabel tone={state === "idle" ? "faint" : "ember"}>
          {state === "listening"
            ? "ouvindo"
            : respondendo && state === "idle"
            ? "respondendo"
            : state === "thinking"
              ? "transcrevendo"
              : "segure para falar"}
        </MicroLabel>
      )}

      {!compacto && aviso && (
        <p className="max-w-[240px] text-center text-xs text-danger">{aviso}</p>
      )}
    </div>
  );
}
