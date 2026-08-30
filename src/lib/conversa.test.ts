import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// O módulo lê `window.localStorage` diretamente. Um duble em memória prova a
// ida e a volta sem navegador — que é onde essa lógica falha em silêncio:
// grava e some, ou volta corrompida e derruba a tela.
class StorageFalso {
  private dados = new Map<string, string>();
  getItem(k: string): string | null {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.dados.set(k, v);
  }
  cheio = false;
}

const storage = new StorageFalso();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

const { carregarConversa, salvarConversa } = await import("./settings.ts");

beforeEach(() => {
  storage.setItem("spider.conversa.v1", "");
});

test("conversa salva volta igual", () => {
  const conversa = [
    { role: "user" as const, content: "quais projetos pedem atenção?" },
    { role: "assistant" as const, content: "Neon está fora do ar." },
  ];
  salvarConversa(conversa);
  assert.deepEqual(carregarConversa(), conversa);
});

test("sem nada salvo devolve lista vazia", () => {
  storage.setItem("spider.conversa.v1", "");
  assert.deepEqual(carregarConversa(), []);
});

test("JSON corrompido nao derruba a tela", () => {
  storage.setItem("spider.conversa.v1", "{isso nao e json");
  assert.deepEqual(carregarConversa(), []);
});

test("JSON valido que nao e lista tambem nao derruba", () => {
  storage.setItem("spider.conversa.v1", '{"role":"user"}');
  assert.deepEqual(carregarConversa(), []);
});

test("descarta mensagem malformada em vez da conversa inteira", () => {
  storage.setItem(
    "spider.conversa.v1",
    JSON.stringify([
      { role: "user", content: "boa" },
      { role: "inventado", content: "papel que nao existe" },
      { content: "sem papel" },
      { role: "assistant", content: 42 },
      { role: "assistant", content: "tambem boa" },
    ]),
  );
  assert.deepEqual(carregarConversa(), [
    { role: "user", content: "boa" },
    { role: "assistant", content: "tambem boa" },
  ]);
});

test("guarda so as ultimas 40 mensagens", () => {
  const muitas = Array.from({ length: 60 }, (_, i) => ({
    role: "user" as const,
    content: `mensagem ${i}`,
  }));
  salvarConversa(muitas);
  const lidas = carregarConversa();
  assert.equal(lidas.length, 40);
  // As ÚLTIMAS, não as primeiras: cortar pelo começo jogaria fora justamente
  // o que acabou de ser dito.
  assert.equal(lidas[0]?.content, "mensagem 20");
  assert.equal(lidas.at(-1)?.content, "mensagem 59");
});
