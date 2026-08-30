"use client";

import { radialTicks, arcPath } from "@/lib/ring";

export type RingState = "idle" | "listening" | "thinking";

const TICKS = radialTicks(48, 74, 82);

/**
 * O anel concêntrico da referência, com função: `level` é o volume do
 * microfone (0..1) e infla o anel interno enquanto se fala; `state` troca o
 * que gira. Um único elemento tem preenchimento de brilho — os outros usam
 * traço fino, que o WebView2 compõe barato.
 */
export function Ring({
  level = 0,
  state = "idle",
  size = 240,
}: {
  level?: number;
  state?: RingState;
  size?: number;
}) {
  const pulso = 1 + Math.min(Math.max(level, 0), 1) * 0.12;
  const ativo = state !== "idle";
  const pensando = state === "thinking";

  // `transform-origin: center` em SVG depende de qual caixa o navegador toma
  // como referência; com a caixa dos traços, o grupo gira em torno de um
  // ponto deslocado e o anel passeia pra fora da tela. Fixar `view-box`
  // amarra o giro ao centro da viewBox, que é onde a geometria mora.
  const giro = (segundos: number, sentido: 1 | -1 = 1) => ({
    transformBox: "view-box" as const,
    transformOrigin: "center" as const,
    animation: `hud-girar ${segundos}s linear infinite${sentido === -1 ? " reverse" : ""}`,
  });

  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} aria-hidden className="select-none">
      {/* Três camadas concêntricas em velocidades diferentes: é o que dá
          sensação de profundidade sem custar uma engine 3D. O olho lê
          paralaxe de rotação como distância. */}
      <circle r="92" fill="none" stroke="var(--color-line)" strokeWidth="0.5" />
      <circle
        r="82"
        fill="none"
        stroke="var(--color-red-dim)"
        strokeWidth="0.5"
        strokeDasharray="2 6"
        style={ativo ? giro(40, -1) : undefined}
      />

      <g
        stroke={ativo ? "var(--color-red)" : "var(--color-ink-faint)"}
        strokeWidth="0.75"
        style={ativo ? giro(120) : undefined}
      >
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            opacity={i % 4 === 0 ? 1 : 0.35}
          />
        ))}
      </g>

      {/* Arcos que giram: devagar quando ouve, mais rápido quando pensa. */}
      <g style={ativo ? giro(pensando ? 3 : 9) : undefined}>
        <path d={arcPath(64, 20, 110)} fill="none" stroke="var(--color-red)" strokeWidth="1.5" />
        <path
          d={arcPath(64, 200, 70)}
          fill="none"
          stroke="var(--color-red)"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <path d={arcPath(54, 140, 200)} fill="none" stroke="var(--color-red-dim)" strokeWidth="1" />
      </g>

      {/* Contra-rotação: duas camadas girando em sentidos opostos leem como
          dois planos separados no espaço, não como um desenho chapado. */}
      <g style={ativo ? giro(pensando ? 6 : 16, -1) : undefined} opacity="0.6">
        <path d={arcPath(46, 300, 40)} fill="none" stroke="var(--color-ember)" strokeWidth="1" />
        <path d={arcPath(46, 120, 30)} fill="none" stroke="var(--color-ember)" strokeWidth="1" />
      </g>

      {/* Anel interno: respira com o volume do microfone enquanto ouve, e
          pulsa sozinho enquanto a resposta é escrita — é o sinal de que ele
          está trabalhando, sem precisar de spinner nenhum. */}
      <g
        style={
          pensando
            ? {
                transformBox: "view-box",
                transformOrigin: "center",
                animation: "hud-pulsar 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite",
              }
            : undefined
        }
      >
        <circle
          r={38 * pulso}
          fill="none"
          stroke="var(--color-ember)"
          strokeWidth="1.5"
          style={{ transition: "r 80ms linear" }}
        />
        <circle
          r={38 * pulso}
          fill="var(--color-red-glow)"
          opacity={pensando ? 0.35 : Math.min(Math.max(level, 0), 1) * 0.6}
        />
      </g>
    </svg>
  );
}
