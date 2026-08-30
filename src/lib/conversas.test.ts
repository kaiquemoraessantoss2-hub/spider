import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

class StorageFalso {
  dados = new Map<string, string>();
  getItem(k: string): string | null {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.dados.set(k, v);
  }
  removeItem(k: string): void {
    this.dados.delete(k);
  }
}

const storage = new StorageFalso();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

const {
  listarConversas,
  salvarConversa,
  carregarConversa,
  apagarConversa,
  tituloDe,
  novoId,
  MAX_CONVERSAS,
} = await import("./conversas.ts");

beforeEach(() => {
  storage.dados.clear();
});

const fala = (texto: string) => ({ role: "user" as const, content: texto });

test("conversa salva aparece na lista e volta igual", () => {
  const id = novoId();
  salvarConversa(id, [fala("o que pegou hoje?")]);
  assert.equal(listarConversas().length, 1);
  assert.deepEqual(carregarConversa(id), [fala("o que pegou hoje?")]);
});

test("conversas diferentes nao se misturam", () => {
  const a = novoId();
  const b = novoId();
  salvarConversa(a, [fala("primeira")]);
  salvarConversa(b, [fala("segunda")]);
  assert.deepEqual(carregarConversa(a), [fala("primeira")]);
  assert.deepEqual(carregarConversa(b), [fala("segunda")]);
  assert.equal(listarConversas().length, 2);
});

test("titulo sai da primeira fala do usuario, nao da do assistente", () => {
  const t = tituloDe([
    { role: "system", content: "instrucoes internas" },
    { role: "assistant", content: "oi" },
    fala("quais projetos estao fora do ar?"),
  ]);
  assert.equal(t, "quais projetos estao fora do ar?");
});

test("titulo longo e cortado", () => {
  const t = tituloDe([fala("a".repeat(100))]);
  assert.ok(t.length <= 49, `titulo ficou com ${t.length}`);
  assert.ok(t.endsWith("…"));
});

test("conversa sem mensagem nao e guardada", () => {
  salvarConversa(novoId(), []);
  assert.equal(listarConversas().length, 0);
});

test("esvaziar uma conversa existente a remove da lista", () => {
  const id = novoId();
  salvarConversa(id, [fala("algo")]);
  salvarConversa(id, []);
  assert.equal(listarConversas().length, 0);
});

test("apagar remove so a conversa pedida", () => {
  const a = novoId();
  const b = novoId();
  salvarConversa(a, [fala("fica")]);
  salvarConversa(b, [fala("some")]);
  apagarConversa(b);
  const restantes = listarConversas();
  assert.equal(restantes.length, 1);
  assert.equal(restantes[0]?.id, a);
});

test("migra a conversa unica do formato antigo", () => {
  storage.setItem(
    "spider.conversa.v1",
    JSON.stringify([fala("pergunta antiga"), { role: "assistant", content: "resposta antiga" }]),
  );
  const lista = listarConversas();
  assert.equal(lista.length, 1);
  assert.equal(lista[0]?.titulo, "pergunta antiga");
  // A chave antiga some para a migração não se repetir a cada leitura.
  assert.equal(storage.getItem("spider.conversa.v1"), null);
});

test("lista corrompida nao derruba a tela", () => {
  storage.setItem("spider.conversas.v1", "{isso nao e json");
  assert.deepEqual(listarConversas(), []);
});

test("guarda no maximo o teto de conversas, descartando as mais antigas", () => {
  for (let i = 0; i < MAX_CONVERSAS + 5; i++) {
    salvarConversa(novoId(), [fala(`conversa ${i}`)]);
  }
  assert.equal(listarConversas().length, MAX_CONVERSAS);
});

test("a mais recente vem primeiro na lista", () => {
  const antiga = novoId();
  salvarConversa(antiga, [fala("velha")]);
  const nova = novoId();
  salvarConversa(nova, [fala("recente")]);
  assert.equal(listarConversas()[0]?.id, nova);
});
