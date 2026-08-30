export interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Ângulo 0 no topo, crescendo no sentido horário — como mostrador de
 * relógio, não como o eixo trigonométrico. É assim que a referência lê.
 */
function pontoNoCirculo(raio: number, graus: number): { x: number; y: number } {
  const rad = ((graus - 90) * Math.PI) / 180;
  return { x: raio * Math.cos(rad), y: raio * Math.sin(rad) };
}

/** 4 casas bastam para o SVG e mantêm servidor e cliente byte a byte iguais. */
function arredonda(n: number): number {
  return Number(n.toFixed(4));
}

export function radialTicks(count: number, inner: number, outer: number): Tick[] {
  const passo = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const graus = i * passo;
    const a = pontoNoCirculo(inner, graus);
    const b = pontoNoCirculo(outer, graus);
    // Arredondar não é cosmético: `Math.cos`/`Math.sin` podem diferir no
    // último bit entre o V8 do Node (que pré-renderiza) e o do WebView2, e o
    // React acusa erro de hidratação ao ver "-64.08587988004845" no HTML do
    // servidor contra -64.08587988004844 no cliente. Mesma precisão que o
    // `arcPath` já usava.
    return { x1: arredonda(a.x), y1: arredonda(a.y), x2: arredonda(b.x), y2: arredonda(b.y) };
  });
}

export function arcPath(radius: number, startDeg: number, sweepDeg: number): string {
  const inicio = pontoNoCirculo(radius, startDeg);
  const fim = pontoNoCirculo(radius, startDeg + sweepDeg);
  const arcoGrande = sweepDeg > 180 ? 1 : 0;
  return (
    `M ${arredonda(inicio.x)} ${arredonda(inicio.y)} ` +
    `A ${radius} ${radius} 0 ${arcoGrande} 1 ${arredonda(fim.x)} ${arredonda(fim.y)}`
  );
}
