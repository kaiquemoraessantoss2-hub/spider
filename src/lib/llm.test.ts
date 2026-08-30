import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { streamChat, PROVIDERS } from "./llm.ts";
import type { Settings } from "./settings.ts";

const SETTINGS: Settings = {
  provider: "openrouter",
  model: "modelo-de-teste",
  keys: { openrouter: "chave-fake", nvidia: "" },
  groqKey: "",
};

function payload(texto: string): string {
  return `data: {"choices":[{"delta":{"content":"${texto}"}}]}\n\n`;
}

/**
 * Sobe um servidor local no lugar da API real, aponta PROVIDERS.openrouter
 * pra ele durante o teste e restaura depois — é a única costura necessária
 * pra exercitar o fetch de verdade (reader.read(), abort propagando pro
 * stream) sem mexer em `llm.ts` além do parâmetro de teste que já existe.
 */
async function comServidor(
  handler: http.RequestListener,
  rodar: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrlOriginal = PROVIDERS.openrouter.baseUrl;
  PROVIDERS.openrouter.baseUrl = `http://127.0.0.1:${port}`;
  try {
    await rodar(PROVIDERS.openrouter.baseUrl);
  } finally {
    PROVIDERS.openrouter.baseUrl = baseUrlOriginal;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function coletar(gen: AsyncGenerator<string>): Promise<string[]> {
  const pedacos: string[] = [];
  for await (const pedaco of gen) pedacos.push(pedaco);
  return pedacos;
}

test("stream lento porem continuo sobrevive ao timeout de inatividade", async () => {
  await comServidor(
    (req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      let n = 0;
      const iv = setInterval(() => {
        n++;
        res.write(payload(`p${n}`));
        if (n >= 4) {
          clearInterval(iv);
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }, 150);
      req.on("close", () => clearInterval(iv));
    },
    async () => {
      // Cada evento chega bem dentro da janela de inatividade (400ms > 150ms
      // de intervalo) — o total de relogio (600ms) passa longe do que seria
      // um teto fixo de 30s, mas aqui o que importa e nao emudecer.
      const pedacos = await coletar(
        streamChat([], SETTINGS, new AbortController().signal, 400),
      );
      assert.deepEqual(pedacos, ["p1", "p2", "p3", "p4"]);
    },
  );
});

test("stream que emudece e abortado pelo timeout de inatividade", async () => {
  await comServidor(
    (req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(payload("p1"));
      res.write(payload("p2"));
      // Depois disso o servidor fica calado de proposito: nunca manda
      // [DONE] nem fecha a conexao. So o timeout de inatividade do cliente
      // deve encerrar isso.
      req.on("close", () => res.end());
    },
    async () => {
      const pedacos: string[] = [];
      await assert.rejects(
        async () => {
          for await (const pedaco of streamChat([], SETTINGS, new AbortController().signal, 300)) {
            pedacos.push(pedaco);
          }
        },
        (erro: unknown) => erro instanceof DOMException && erro.name === "TimeoutError",
      );
      // Os dois eventos que chegaram antes do silencio nao se perdem —
      // só o que vem depois do silencio é que nunca chega.
      assert.deepEqual(pedacos, ["p1", "p2"]);
    },
  );
});
