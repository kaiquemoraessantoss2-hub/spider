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

export function radialTicks(count: number, inner: number, outer: number): Tick[] {
  const passo = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const graus = i * passo;
    const a = pontoNoCirculo(inner, graus);
    const b = pontoNoCirculo(outer, graus);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

export function arcPath(radius: number, startDeg: number, sweepDeg: number): string {
  const inicio = pontoNoCirculo(radius, startDeg);
  const fim = pontoNoCirculo(radius, startDeg + sweepDeg);
  const arcoGrande = sweepDeg > 180 ? 1 : 0;
  const arredonda = (n: number) => Number(n.toFixed(4));
  return (
    `M ${arredonda(inicio.x)} ${arredonda(inicio.y)} ` +
    `A ${radius} ${radius} 0 ${arcoGrande} 1 ${arredonda(fim.x)} ${arredonda(fim.y)}`
  );
}
