"use client";

import { useEffect, useRef } from "react";

interface Particula {
  x: number;
  y: number;
  z: number; // 0 = fundo, 1 = frente. Manda no tamanho, no brilho e no parallax.
  vx: number;
  vy: number;
  brasa: boolean;
}

const QUANTIDADE = 90;
/** Fração de partículas em brasa. Poucas: se tudo brilha, nada brilha. */
const PROPORCAO_BRASA = 0.12;

/**
 * Poeira à deriva atrás da interface. Canvas, não DOM: noventa elementos
 * posicionados fariam o navegador recalcular layout a cada quadro, enquanto
 * um canvas é uma textura só. Nada de blur nem sombra — o WebView2 perde
 * quadros com camadas de desfoque, então a profundidade vem de tamanho,
 * opacidade e velocidade, que é como o olho lê distância mesmo.
 */
export function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paradoPorPreferencia = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let largura = 0;
    let altura = 0;
    let particulas: Particula[] = [];
    // Alvo do parallax: para onde o campo se desloca conforme o ponteiro.
    let alvoX = 0;
    let alvoY = 0;
    let deslocX = 0;
    let deslocY = 0;

    function semear() {
      particulas = Array.from({ length: QUANTIDADE }, () => ({
        x: Math.random() * largura,
        y: Math.random() * altura,
        z: Math.random(),
        // Deriva lenta e majoritariamente ascendente: dá sensação de suspensão,
        // não de chuva. Partícula da frente anda mais que a do fundo.
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.04 - Math.random() * 0.09,
        brasa: Math.random() < PROPORCAO_BRASA,
      }));
    }

    function redimensionar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = canvas!.clientWidth;
      altura = canvas!.clientHeight;
      canvas!.width = largura * dpr;
      canvas!.height = altura * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!particulas.length) semear();
    }

    function desenhar() {
      ctx!.clearRect(0, 0, largura, altura);

      // Amortece o parallax: seguir o ponteiro na hora dá impressão de coisa
      // colada no cursor, não de profundidade.
      deslocX += (alvoX - deslocX) * 0.04;
      deslocY += (alvoY - deslocY) * 0.04;

      for (const p of particulas) {
        const profundidade = 0.35 + p.z * 0.65;
        const px = p.x + deslocX * profundidade;
        const py = p.y + deslocY * profundidade;

        ctx!.beginPath();
        ctx!.arc(px, py, 0.4 + p.z * 1.1, 0, Math.PI * 2);
        ctx!.fillStyle = p.brasa
          ? `rgba(255, 59, 48, ${0.12 + p.z * 0.5})`
          : `rgba(237, 237, 236, ${0.05 + p.z * 0.16})`;
        ctx!.fill();
      }
    }

    function passo() {
      for (const p of particulas) {
        p.x += p.vx * (0.4 + p.z);
        p.y += p.vy * (0.4 + p.z);

        // Reentra pelo lado oposto em vez de sumir: campo infinito sem
        // precisar criar e destruir objeto a cada quadro.
        if (p.y < -4) {
          p.y = altura + 4;
          p.x = Math.random() * largura;
        }
        if (p.x < -4) p.x = largura + 4;
        if (p.x > largura + 4) p.x = -4;
      }
      desenhar();
      quadro = requestAnimationFrame(passo);
    }

    function moverPonteiro(e: PointerEvent) {
      alvoX = (e.clientX / window.innerWidth - 0.5) * -26;
      alvoY = (e.clientY / window.innerHeight - 0.5) * -18;
    }

    let quadro = 0;
    redimensionar();
    window.addEventListener("resize", redimensionar);

    if (paradoPorPreferencia) {
      // Quem pediu menos movimento recebe o campo parado, não a tela vazia:
      // a textura continua, a deriva é que some.
      desenhar();
    } else {
      window.addEventListener("pointermove", moverPonteiro);
      quadro = requestAnimationFrame(passo);
    }

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", moverPonteiro);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
