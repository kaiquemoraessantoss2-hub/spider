import { test } from "node:test";
import assert from "node:assert/strict";
import { radialTicks, arcPath } from "./ring.ts";

function perto(a: number, b: number, msg: string) {
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);
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
    perto(Math.hypot(t.x1, t.y1), 30, "raio interno");
    perto(Math.hypot(t.x2, t.y2), 40, "raio externo");
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
