import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "./context.ts";
import type { ClientProject } from "../types/project.ts";

const projeto: ClientProject = {
  id: "neon-cosmeticos",
  display_name: "Neon Cosméticos",
  path: "C:/projetos/neon",
  brand: "koder",
  git: {
    branch: "main",
    dirty_files: 0,
    unpushed_commits: 0,
    last_commit_at: "2026-08-10T11:00:00-03:00",
    last_commit_message: "atualiza plugin de checkout",
    error: null,
  },
  hosting: { health: "down", http_status: 522, checked_at: "2026-08-23T09:00:00-03:00" },
  billing: { status: "vencida", next_due_at: "2026-08-15T00:00:00-03:00", amount_cents: null },
};

test("inclui o nome de exibicao e a branch", () => {
  const prompt = buildSystemPrompt([projeto]);
  assert.match(prompt, /Neon Cosméticos/);
  assert.match(prompt, /main/);
});

test("descreve site fora do ar com o codigo http", () => {
  const prompt = buildSystemPrompt([projeto]);
  assert.match(prompt, /fora do ar/);
  assert.match(prompt, /522/);
});

test("descreve cobranca vencida", () => {
  const prompt = buildSystemPrompt([projeto]);
  assert.match(prompt, /vencida/);
});

test("omite integracao nao configurada em vez de dizer null", () => {
  const semIntegracao: ClientProject = { ...projeto, hosting: null, billing: null };
  const prompt = buildSystemPrompt([semIntegracao]);
  assert.doesNotMatch(prompt, /null/);
  assert.match(prompt, /não configurado/);
});

test("proibe o modelo de prometer acao", () => {
  const prompt = buildSystemPrompt([projeto]);
  assert.match(prompt, /NÃO executa/);
});

test("aguenta lista vazia sem quebrar", () => {
  const prompt = buildSystemPrompt([]);
  assert.match(prompt, /Nenhum projeto/);
});

test("reporta erro de git no lugar do estado", () => {
  const quebrado: ClientProject = {
    ...projeto,
    git: { ...projeto.git, error: "não é um repositório git" },
  };
  const prompt = buildSystemPrompt([quebrado]);
  assert.match(prompt, /não é um repositório git/);
});
