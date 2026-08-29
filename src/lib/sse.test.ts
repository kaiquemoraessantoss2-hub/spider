import { test } from "node:test";
import assert from "node:assert/strict";
import { SSEBuffer } from "./sse.ts";

test("devolve o payload de uma linha data: completa", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push('data: {"a":1}\n'), ['{"a":1}']);
});

test("junta um chunk partido no meio do JSON", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push('data: {"a":'), []);
  assert.deepEqual(buf.push("1}\n"), ['{"a":1}']);
});

test("junta um chunk partido no meio do prefixo data:", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push("da"), []);
  assert.deepEqual(buf.push('ta: {"b":2}\n'), ['{"b":2}']);
});

test("devolve varios payloads que chegam no mesmo chunk", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push("data: 1\ndata: 2\n"), ["1", "2"]);
});

test("ignora comentarios e linhas em branco do protocolo", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push(": keep-alive\n\ndata: 3\n"), ["3"]);
});

test("tolera terminador CRLF", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push('data: {"c":3}\r\n'), ['{"c":3}']);
});

test("preserva o marcador [DONE] em vez de engolir", () => {
  const buf = new SSEBuffer();
  assert.deepEqual(buf.push("data: [DONE]\n"), ["[DONE]"]);
});
