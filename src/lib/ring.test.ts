import { test } from "node:test";
import assert from "node:assert/strict";
import { radialTicks, arcPath } from "./ring.ts";

function perto(a: number, b: number, msg: string, tolerancia = 1e-9) {
  assert.ok(Math.abs(a - b) < tolerancia, `${msg}: ${a} != ${b}`);
}

test("gera a quantidade pedida de ticks", () => {
  assert.equal(radialTicks(24, 10, 20).length, 24);
});

test("o primeiro tick aponta pra cima", () => {
  const [primeiro] = radialTicks(4, 10, 20);
  assert.ok(primeiro);
  perto(primeiro.x1, 0, "x interno");
  perto(primeiro.y1, -10, "y interno");
  perto(primeiro.x2, 0, "x externo");
  perto(primeiro.y2, -20, "y externo");
});

test("o segundo tick de quatro aponta pra direita", () => {
  const segundo = radialTicks(4, 10, 20)[1];
  assert.ok(segundo);
  perto(segundo.x1, 10, "x interno");
  perto(segundo.y1, 0, "y interno");
});

test("tick sempre vai do raio interno pro externo", () => {
  for (const t of radialTicks(12, 30, 40)) {
    // Tolerância de 1e-3, não 1e-9: as coordenadas são arredondadas para 4
    // casas de propósito (ver o teste seguinte), o que desloca o raio em até
    // ~3e-5. Exigir precisão de ponto flutuante aqui brigaria com isso.
    perto(Math.hypot(t.x1, t.y1), 30, "raio interno", 1e-3);
    perto(Math.hypot(t.x2, t.y2), 40, "raio externo", 1e-3);
  }
});

test("coordenadas saem arredondadas a 4 casas", () => {
  // Isto não é estética: `Math.cos`/`Math.sin` podem diferir no último bit
  // entre o V8 do Node (que pré-renderiza a página) e o do WebView2. Sem
  // arredondar, o React acusa erro de hidratação porque o HTML do servidor
  // traz "-64.08587988004845" e o cliente calcula -64.08587988004844.
  for (const t of radialTicks(48, 74, 82)) {
    for (const n of [t.x1, t.y1, t.x2, t.y2]) {
      assert.equal(n, Number(n.toFixed(4)), `${n} tem mais de 4 casas decimais`);
    }
  }
});

test("arco de 90 graus começa no topo e termina na direita", () => {
  const d = arcPath(10, 0, 90);
  assert.match(d, /^M 0 -10/);
  assert.match(d, /A 10 10 0 0 1 10 0$/);
});

test("arco maior que 180 graus usa a flag de arco grande", () => {
  assert.match(arcPath(10, 0, 270), /A 10 10 0 1 1/);
});
