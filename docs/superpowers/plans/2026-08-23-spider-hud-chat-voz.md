# Spider — HUD, chat e voz · Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para implementar tarefa por tarefa. Os passos
> usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Transformar o painel passivo do Spider numa cabine HUD onde o dono
pergunta — por texto ou por voz — o que está pegando nos projetos, e é
respondido por um modelo que lê o estado coletado.

**Architecture:** O webview chama a API OpenAI-compatible direto (OpenRouter
ou NVIDIA NIM, `baseUrl` trocável), com a key em `localStorage`. O estado dos
projetos que o painel já busca do Rust vira system message a cada turno. A
voz entra por `MediaRecorder` → ASR da NIM e sai por `speechSynthesis` do
WebView2. Nenhuma tool é exposta ao modelo: ele lê e responde, não executa.

**Tech Stack:** Next 16 (App Router, static export) · React 19 · Tailwind v4
· Tauri v2 · TanStack Query · `node --test` com type stripping nativo do
Node 24 (zero dependência de teste nova).

**Spec:** `docs/superpowers/specs/2026-08-23-spider-hud-chat-voz-design.md`

## Global Constraints

- **Nenhuma tool de execução é exposta ao modelo.** O chat lê estado e
  responde. Não implemente function calling, nem comandos, nem escrita em
  disco a pedido do modelo.
- **Mono só em dado técnico**: branch, contagem, hash, timestamp. Prosa,
  título, label e status legível vão em sans. Essa é a queixa que originou o
  trabalho — violá-la reprova a tarefa.
- **Micro-labels**: uppercase, 9–10px, `tracking-[0.25em]`, cor
  `--color-ink-muted`.
- **Glow com parcimônia**: `box-shadow`/`drop-shadow` de blur grande só em
  poucos pontos-chave. O resto simula com `radial-gradient`. WebView2 perde
  FPS com muitas camadas de blur.
- **Cores só via token** de `globals.css`. Nada de hex solto no JSX.
- **Sem `any`.** TypeScript strict com `noUncheckedIndexedAccess` já ligado —
  índice de array retorna `T | undefined` e o compilador vai cobrar.
- **Colapso responsivo**: abaixo de 1100px de largura o core central vira um
  anel pequeno no header e o layout cai para duas colunas.
- **Key da API em `localStorage`**, texto puro, decisão consciente do spec.
  Não invente criptografia caseira.
- **Idioma da interface: PT-BR.**

## Pré-requisitos de ambiente

1. **Não é repositório git.** Os passos de commit assumem que sim. Rode
   `git init && git add -A && git commit -m "chore: estado inicial"` antes da
   Tarefa 1, ou pule todo passo de commit — mas então pare de considerar cada
   tarefa "entregue" no commit.
2. **`SPIDER_PROJECTS_ROOT`** precisa apontar para a pasta que contém as
   pastas dos clientes, senão todo card abre com erro:
   `[Environment]::SetEnvironmentVariable("SPIDER_PROJECTS_ROOT", "C:\Users\kaique\projetos", "User")`
   Reabra o terminal depois.
3. **Keys**: uma de OpenRouter (openrouter.ai/keys) e uma de NVIDIA NIM
   (build.nvidia.com). Ambas de tier gratuito.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/sse.ts` | Buffer de Server-Sent Events. Puro, sem rede. |
| `src/lib/sse.test.ts` | Testes do buffer, incluindo chunk partido no meio. |
| `src/lib/settings.ts` | Provider, key e modelo em `localStorage`. |
| `src/lib/llm.ts` | Catálogo de providers e `streamChat()`. |
| `src/lib/context.ts` | Projetos → texto do system message. Puro. |
| `src/lib/context.test.ts` | Testes do resumo. |
| `src/lib/voice.ts` | Gravação, transcrição e fala. |
| `src/lib/ring.ts` | Geometria dos anéis (ticks, arcos). Puro. |
| `src/lib/ring.test.ts` | Testes de geometria. |
| `src/components/hud/Ring.tsx` | SVG dos anéis concêntricos. |
| `src/components/hud/MicroLabel.tsx` | Label uppercase com tracking. |
| `src/components/VoiceCore.tsx` | Core central: push-to-talk + estado. |
| `src/components/ChatPanel.tsx` | Coluna direita: conversa e input. |
| `src/components/SettingsDialog.tsx` | Provider, key, modelo. |
| `src/app/page.tsx` | Layout de três colunas. |
| `src/app/globals.css` | Tokens, fundo, primitivas HUD. |
| `src/app/layout.tsx` | Fontes Saira + Inter + Plex Mono. |

---

### Task 1: Spike — o microfone funciona no WebView2?

Isso vem primeiro porque pode invalidar o desenho da voz. Se `getUserMedia`
for negado pelo WebView2, a captura migra para a crate `cpal` no Rust — meio
dia a mais, e melhor descobrir agora do que depois de construir a UI.

**Files:**
- Modify: `src/app/page.tsx` (código temporário, removido no fim da tarefa)

**Interfaces:**
- Consumes: nada.
- Produces: uma decisão registrada no plano — captura no webview ou no Rust.

- [ ] **Step 1: Botão temporário de teste**

Adicione no topo do `<main>` de `src/app/page.tsx`:

```tsx
<button
  type="button"
  onClick={async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert(`OK: ${stream.getAudioTracks()[0]?.label ?? "faixa sem nome"}`);
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      alert(`FALHOU: ${e}`);
    }
  }}
>
  testar microfone
</button>
```

- [ ] **Step 2: Rodar o app nativo**

Run: `npm run app:dev`

Clique no botão **na janela do Tauri**, não no navegador — o navegador
concede microfone sozinho e daria um falso positivo.

- [ ] **Step 3: Registrar o resultado**

- Alert com "OK" → siga o plano como está.
- Alert com "FALHOU" → **pare**. Anote o erro exato neste arquivo, sob esta
  tarefa, e avise o dono: as Tarefas 9 e 10 precisam ser reescritas para
  `cpal` no Rust antes de continuar. As Tarefas 2 a 8 seguem válidas e podem
  ser feitas enquanto isso.

- [ ] **Step 4: Remover o botão**

Desfaça a alteração em `src/app/page.tsx`. O spike não deixa código.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-08-23-spider-hud-chat-voz.md
git commit -m "docs: registra resultado do spike de microfone no WebView2"
```

---

### Task 2: Harness de teste + parser de SSE

O parser é o único pedaço do streaming que quebra de forma silenciosa: a rede
parte o chunk no meio de um `data:` e implementações ingênuas perdem o
pedaço. É por isso que ele nasce testado.

**Files:**
- Create: `src/lib/sse.ts`
- Create: `src/lib/sse.test.ts`
- Modify: `package.json` (script `test`)
- Modify: `tsconfig.json` (`allowImportingTsExtensions`)

**Interfaces:**
- Consumes: nada.
- Produces: `class SSEBuffer` com `push(chunk: string): string[]` — devolve os
  payloads de `data:` completos contidos no que chegou até agora.

- [ ] **Step 1: Habilitar import com extensão .ts**

Em `tsconfig.json`, dentro de `compilerOptions`, adicione:

```json
"allowImportingTsExtensions": true,
```

O runner do Node exige o caminho real do arquivo no import; o TypeScript só
aceita isso com essa flag (permitida porque `noEmit` já é `true`).

- [ ] **Step 2: Adicionar o script de teste**

Em `package.json`, em `scripts`:

```json
"test": "node --test src/lib"
```

Node 24 remove os tipos sozinho — nenhuma dependência de teste é instalada.
`node --test <pasta>` descobre arquivos `*.test.ts` pela convenção de nome.

- [ ] **Step 3: Escrever o teste que falha**

`src/lib/sse.test.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test`

Expected: FAIL — `Cannot find module './sse.ts'`.

- [ ] **Step 5: Implementar**

`src/lib/sse.ts`:

```ts
/**
 * Acumula chunks de um stream SSE e devolve, a cada empurrão, os payloads
 * `data:` que ficaram completos. A rede parte chunks em qualquer byte —
 * inclusive no meio do prefixo `data:` — então o estado parcial fica aqui,
 * e não espalhado por quem consome.
 */
export class SSEBuffer {
  private pending = "";

  push(chunk: string): string[] {
    this.pending += chunk;
    const payloads: string[] = [];

    let newline = this.pending.indexOf("\n");
    while (newline !== -1) {
      const line = this.pending.slice(0, newline).replace(/\r$/, "");
      this.pending = this.pending.slice(newline + 1);

      if (line.startsWith("data:")) {
        payloads.push(line.slice("data:".length).trim());
      }

      newline = this.pending.indexOf("\n");
    }

    return payloads;
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test`

Expected: PASS — 7 testes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sse.ts src/lib/sse.test.ts package.json tsconfig.json
git commit -m "feat: parser de SSE tolerante a chunk partido"
```

---

### Task 3: Configurações e cliente LLM

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/lib/llm.ts`

**Interfaces:**
- Consumes: `SSEBuffer` de `./sse.ts`.
- Produces:
  - `type ProviderId = "openrouter" | "nvidia"`
  - `interface Settings { provider: ProviderId; model: string; keys: Record<ProviderId, string> }`
  - `loadSettings(): Settings` / `saveSettings(s: Settings): void`
  - `PROVIDERS: Record<ProviderId, ProviderConfig>` com `label`, `baseUrl`, `models: string[]`
  - `interface ChatMessage { role: "system" | "user" | "assistant"; content: string }`
  - `streamChat(messages: ChatMessage[], settings: Settings, signal: AbortSignal): AsyncGenerator<string>`
  - `class MissingKeyError extends Error`

- [ ] **Step 1: Escrever settings.ts**

```ts
export type ProviderId = "openrouter" | "nvidia";

export interface Settings {
  provider: ProviderId;
  model: string;
  /** Uma key por provider — trocar de provider não apaga a outra. */
  keys: Record<ProviderId, string>;
}

const STORAGE_KEY = "spider.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  model: "deepseek/deepseek-chat-v3.1:free",
  keys: { openrouter: "", nvidia: "" },
};

/**
 * A key vive em texto puro no localStorage do WebView2 (%LOCALAPPDATA%).
 * Decisão consciente do spec: app local, single-user, key de tier gratuito.
 * Se virar key paga, este arquivo é o único ponto a migrar para o
 * Credential Manager do Windows.
 */
export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      provider: parsed.provider ?? DEFAULT_SETTINGS.provider,
      model: parsed.model ?? DEFAULT_SETTINGS.model,
      keys: { ...DEFAULT_SETTINGS.keys, ...parsed.keys },
    };
  } catch {
    // localStorage indisponível ou JSON corrompido: seguir com o padrão é
    // melhor do que derrubar a tela inteira por causa de configuração.
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sem espaço ou storage bloqueado: a sessão atual continua funcionando
    // com o valor em memória.
  }
}
```

- [ ] **Step 2: Escrever llm.ts**

```ts
import { SSEBuffer } from "./sse.ts";
import type { ProviderId, Settings } from "./settings.ts";

export interface ProviderConfig {
  label: string;
  baseUrl: string;
  /**
   * Modelos gratuitos conhecidos. Lista curada à mão de propósito —
   * descoberta dinâmica de catálogo não vale a complexidade aqui.
   */
  models: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "deepseek/deepseek-chat-v3.1:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-235b-a22b:free",
      "google/gemma-3-27b-it:free",
    ],
  },
  nvidia: {
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    models: [
      "meta/llama-3.3-70b-instruct",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-coder-32b-instruct",
    ],
  },
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MissingKeyError extends Error {
  constructor(provider: ProviderId) {
    super(`configure a key de ${PROVIDERS[provider].label} nas configurações`);
    this.name = "MissingKeyError";
  }
}

/**
 * Streama a resposta em pedaços de texto. OpenRouter e NVIDIA NIM expõem o
 * mesmo `/chat/completions`, então o provider é só baseUrl + key + modelo.
 */
export async function* streamChat(
  messages: ChatMessage[],
  settings: Settings,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const provider = PROVIDERS[settings.provider];
  const key = settings.keys[settings.provider];
  if (!key) throw new MissingKeyError(settings.provider);

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: settings.model, messages, stream: true }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `${provider.label} respondeu ${response.status}: ${detail.slice(0, 300)}`,
    );
  }
  if (!response.body) throw new Error("resposta sem corpo");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const buffer = new SSEBuffer();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const payload of buffer.push(decoder.decode(value, { stream: true }))) {
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Payload que não é JSON válido (keep-alive de proxy, por exemplo).
        // Ignorar é correto: perder um chunk decorativo é melhor do que
        // derrubar a conversa inteira.
      }
    }
  }
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run typecheck`

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/settings.ts src/lib/llm.ts
git commit -m "feat: cliente OpenAI-compatible para OpenRouter e NVIDIA NIM"
```

---

### Task 4: Contexto dos projetos para o modelo

O modelo precisa do estado em texto compacto. JSON cru desperdiça tokens e
confunde modelos menores — que são justamente os gratuitos.

**Files:**
- Create: `src/lib/context.ts`
- Create: `src/lib/context.test.ts`

**Interfaces:**
- Consumes: `ClientProject` de `../types/project.ts`.
- Produces: `buildSystemPrompt(projects: ClientProject[]): string`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/context.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`

Expected: FAIL — `Cannot find module './context.ts'`.

- [ ] **Step 3: Implementar**

`src/lib/context.ts`:

```ts
import type { ClientProject } from "../types/project.ts";

const HEALTH_LABEL = {
  up: "no ar",
  down: "fora do ar",
  unknown: "estado desconhecido",
} as const;

const BILLING_LABEL = {
  em_dia: "em dia",
  vencendo: "vencendo",
  vencida: "vencida",
  desconhecido: "desconhecida",
} as const;

function describe(project: ClientProject): string {
  const linhas: string[] = [`## ${project.display_name} (${project.id})`];

  if (project.brand) linhas.push(`marca: ${project.brand}`);

  if (project.git.error) {
    linhas.push(`git: ${project.git.error}`);
  } else {
    const { branch, dirty_files, unpushed_commits } = project.git;
    linhas.push(
      `git: branch ${branch}, ${dirty_files} arquivo(s) sujo(s), ` +
        `${unpushed_commits} commit(s) não enviado(s)`,
    );
    if (project.git.last_commit_message) {
      linhas.push(
        `último commit: "${project.git.last_commit_message}" em ${project.git.last_commit_at}`,
      );
    }
  }

  linhas.push(
    project.hosting
      ? `site: ${HEALTH_LABEL[project.hosting.health]}` +
          (project.hosting.http_status ? ` (HTTP ${project.hosting.http_status})` : "")
      : "site: não configurado",
  );

  linhas.push(
    project.billing
      ? `cobrança: ${BILLING_LABEL[project.billing.status]}` +
          (project.billing.next_due_at ? `, vence ${project.billing.next_due_at}` : "")
      : "cobrança: não configurado",
  );

  return linhas.join("\n");
}

/**
 * Texto compacto em vez de JSON cru: os modelos gratuitos são menores e
 * gastam contexto à toa lendo chaves e colchetes.
 */
export function buildSystemPrompt(projects: ClientProject[]): string {
  const corpo = projects.length
    ? projects.map(describe).join("\n\n")
    : "Nenhum projeto foi coletado ainda.";

  return [
    "Você é o Spider, assistente do painel de operação de uma agência.",
    "Responde em português do Brasil, direto, sem enrolação e sem repetir a pergunta.",
    "Você lê o estado abaixo e responde sobre ele — você NÃO executa nada:",
    "não roda comando, não faz commit, não abre projeto, não corrige nada.",
    "Se pedirem uma ação, diga o que fazer e onde, sem prometer ter feito.",
    "Não invente projeto, número ou data que não esteja no estado abaixo.",
    "",
    "# Estado atual dos projetos",
    "",
    corpo,
  ].join("\n");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`

Expected: PASS — 14 testes no total (7 de SSE, 7 de contexto).

- [ ] **Step 5: Commit**

```bash
git add src/lib/context.ts src/lib/context.test.ts
git commit -m "feat: monta o system prompt a partir do estado dos projetos"
```

---

### Task 5: Fundação visual — tokens e tipografia

Aqui a queixa original é resolvida: mono sai da prosa e do label, e entra a
sans larga que sustenta o tracking aberto da referência.

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/hud/MicroLabel.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Tokens CSS `--font-display`, `--color-ember`, `--color-void-deep`, e as
    classes `.hud-vignette`, `.hud-glow-node`, `.font-display`.
  - `<MicroLabel tone?="muted" | "ember" | "faint">` — `<span>` uppercase 9px
    com tracking 0.25em.

- [ ] **Step 1: Trocar as fontes**

Em `src/app/layout.tsx`, troque o import de fontes e acrescente a declaração:

```tsx
import { Inter, IBM_Plex_Mono, Saira } from "next/font/google";

const saira = Saira({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});
```

E no `<html>`, some a variável nova às existentes:

```tsx
<html lang="pt-BR" className={`${inter.variable} ${plexMono.variable} ${saira.variable}`}>
```

- [ ] **Step 2: Somar os tokens novos**

Em `src/app/globals.css`, dentro do bloco `@theme`, acrescente:

```css
  --font-display: "Saira", ui-sans-serif, system-ui, sans-serif;

  --color-ember: #ff3b30;
  --color-void-deep: #050506;
```

E troque o fundo do `body`:

```css
body {
  background: var(--color-void-deep);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Vinheta radial e brilho barato**

Ainda em `globals.css`, no fim do arquivo:

```css
/* O vermelho da referência só funciona porque o entorno é vazio. A vinheta
   escurece as bordas e faz o centro parecer iluminado sem custar uma única
   camada de blur. */
.hud-vignette {
  background: radial-gradient(
    ellipse 80% 60% at 50% 40%,
    #0e0e11 0%,
    var(--color-void-deep) 70%
  );
}

/* Brilho simulado por gradiente em vez de box-shadow: o WebView2 compõe
   gradiente de graça e perde FPS com blur grande repetido. */
.hud-glow-node {
  background: radial-gradient(
    circle,
    var(--color-ember) 0%,
    var(--color-red-glow) 45%,
    transparent 70%
  );
}

.font-display {
  font-family: var(--font-display);
}
```

- [ ] **Step 4: Criar o MicroLabel**

`src/components/hud/MicroLabel.tsx`:

```tsx
/**
 * A densidade técnica da referência vem daqui: label minúsculo, caixa alta,
 * tracking muito aberto. Em sans, não em mono — mono fica reservado a dado
 * técnico de verdade (branch, contagem, timestamp).
 */
export function MicroLabel({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "ember" | "faint";
}) {
  const color =
    tone === "ember" ? "text-red" : tone === "faint" ? "text-ink-faint" : "text-ink-muted";

  return (
    <span
      className={`font-display text-[9px] font-medium uppercase tracking-[0.25em] ${color}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck` — sem erros.

Run: `npm run dev`, abra `localhost:3000`. O fundo deve estar mais escuro que
antes. Nada mais muda ainda — os componentes só passam a usar isso na Tarefa 7.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/components/hud/MicroLabel.tsx
git commit -m "feat: tokens HUD, fonte de display Saira e micro-label"
```

---

### Task 6: Geometria e componente dos anéis

**Files:**
- Create: `src/lib/ring.ts`
- Create: `src/lib/ring.test.ts`
- Create: `src/components/hud/Ring.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface Tick { x1: number; y1: number; x2: number; y2: number }`
  - `radialTicks(count: number, inner: number, outer: number): Tick[]` — centro
    em (0,0), primeiro tick no topo, sentido horário.
  - `arcPath(radius: number, startDeg: number, sweepDeg: number): string` —
    caminho SVG de arco, centro em (0,0).
  - `type RingState = "idle" | "listening" | "thinking"`
  - `<Ring level?={number} state?={RingState} size?={number} />`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/ring.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`

Expected: FAIL — `Cannot find module './ring.ts'`.

- [ ] **Step 3: Implementar a geometria**

`src/lib/ring.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`

Expected: PASS — 20 testes no total.

- [ ] **Step 5: Escrever o componente**

`src/components/hud/Ring.tsx`:

```tsx
"use client";

import { radialTicks, arcPath } from "@/lib/ring";

export type RingState = "idle" | "listening" | "thinking";

const TICKS = radialTicks(48, 74, 82);

/**
 * O anel concêntrico da referência, com função: `level` é o volume do
 * microfone (0..1) e infla o anel interno enquanto se fala; `state` troca o
 * que gira. Um único elemento tem preenchimento de brilho — os outros usam
 * traço fino, que o WebView2 compõe barato.
 */
export function Ring({
  level = 0,
  state = "idle",
  size = 240,
}: {
  level?: number;
  state?: RingState;
  size?: number;
}) {
  const pulso = 1 + Math.min(Math.max(level, 0), 1) * 0.12;
  const ativo = state !== "idle";

  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} aria-hidden className="select-none">
      <circle r="92" fill="none" stroke="var(--color-line)" strokeWidth="0.5" />
      <circle
        r="82"
        fill="none"
        stroke="var(--color-red-dim)"
        strokeWidth="0.5"
        strokeDasharray="2 6"
      />

      <g stroke={ativo ? "var(--color-red)" : "var(--color-ink-faint)"} strokeWidth="0.75">
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            opacity={i % 4 === 0 ? 1 : 0.35}
          />
        ))}
      </g>

      {/* Arcos que giram: devagar quando ouve, mais rápido quando pensa. */}
      <g
        className={ativo ? "origin-center animate-spin" : ""}
        style={{ animationDuration: state === "thinking" ? "3s" : "9s" }}
      >
        <path d={arcPath(64, 20, 110)} fill="none" stroke="var(--color-red)" strokeWidth="1.5" />
        <path
          d={arcPath(64, 200, 70)}
          fill="none"
          stroke="var(--color-red)"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <path d={arcPath(54, 140, 200)} fill="none" stroke="var(--color-red-dim)" strokeWidth="1" />
      </g>

      {/* Anel interno: respira com o volume do microfone. */}
      <circle
        r={38 * pulso}
        fill="none"
        stroke="var(--color-ember)"
        strokeWidth="1.5"
        style={{ transition: "r 80ms linear" }}
      />
      <circle r={38 * pulso} fill="var(--color-red-glow)" opacity={level * 0.6} />
    </svg>
  );
}
```

- [ ] **Step 6: Verificar**

Run: `npm run typecheck` — sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ring.ts src/lib/ring.test.ts src/components/hud/Ring.tsx
git commit -m "feat: geometria e componente dos aneis do HUD"
```

---

### Task 7: Layout de três colunas e cards restilizados

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ProjectCard.tsx`
- Modify: `src/components/StatusDot.tsx`

**Interfaces:**
- Consumes: `MicroLabel`, `VoiceCore` (Tarefa 9), `ChatPanel` (Tarefa 8),
  `overallTone`, `fetchProjects`.
- Produces: a página com três regiões — `<aside>` de cards, `<section>`
  central com o core e `<aside>` do chat.

- [ ] **Step 1: Tirar o mono da prosa nos componentes existentes**

Em `src/components/StatusDot.tsx`, troque a classe do label:

```tsx
      <span className="font-display text-[10px] uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </span>
```

Em `src/components/ProjectCard.tsx`:
- O `<h2>` do nome vira `className="font-display text-[15px] font-medium tracking-wide text-ink"`.
- O rótulo da marca e o botão "Abrir no Orca" trocam `font-mono` por `font-display`.
- Os `<dt>` do `Row` viram `<MicroLabel>` (importe de `@/components/hud/MicroLabel`).
- **Só continuam em `font-mono`**: a contagem de arquivos/commits e o
  timestamp relativo. Esses são dado técnico.

- [ ] **Step 2: Reescrever a página em três colunas**

`src/app/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@/lib/tauri";
import { ProjectCard } from "@/components/ProjectCard";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { VoiceCore } from "@/components/VoiceCore";
import { ChatPanel } from "@/components/ChatPanel";
import { overallTone } from "@/lib/status";

export default function Home() {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    refetchInterval: 5 * 60 * 1000,
  });

  const attentionCount =
    projects?.filter((p) => overallTone(p) !== "ok" && overallTone(p) !== "neutral").length ?? 0;

  return (
    <main className="hud-vignette flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-sm font-semibold tracking-[0.42em] text-ink">
            SPIDER
          </span>
          <MicroLabel tone="ember">inteligência operacional</MicroLabel>
        </div>
        <MicroLabel>
          {isLoading
            ? "sincronizando"
            : `${projects?.length ?? 0} projetos · ${attentionCount} pedindo atenção`}
        </MicroLabel>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-line min-[1100px]:grid-cols-[360px_1fr_380px]">
        <aside className="overflow-y-auto bg-void-deep p-4">
          <div className="mb-3">
            <MicroLabel tone="faint">projetos</MicroLabel>
          </div>
          {error && (
            <p className="font-display text-xs text-danger">
              falha ao carregar: {String(error)}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {projects?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </aside>

        {/* O core some abaixo de 1100px: em janela estreita ele roubaria o
            espaço de quem manda, que é o dado. */}
        <section className="hidden items-center justify-center bg-void-deep min-[1100px]:flex">
          <VoiceCore />
        </section>

        <aside className="flex flex-col overflow-hidden bg-void-deep">
          <ChatPanel projects={projects ?? []} />
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Conferir na tela**

Run: `npm run dev` e abra `localhost:3000`.

Esperado: três colunas com dado mockado; nenhuma prosa em monoespaçada; o
core no meio; abaixo de 1100px de largura ele some e sobram duas colunas.

`ChatPanel` e `VoiceCore` só nascem nas Tarefas 8 e 9 — até lá o dev server
reclama de import faltando, o que é esperado. Para ver a tela antes disso,
comente as duas linhas.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/ProjectCard.tsx src/components/StatusDot.tsx
git commit -m "feat: layout de tres colunas e tipografia sem mono na prosa"
```

---

### Task 8: Painel de chat com streaming

**Files:**
- Create: `src/components/ChatPanel.tsx`
- Create: `src/components/SettingsDialog.tsx`

**Interfaces:**
- Consumes: `streamChat`, `MissingKeyError`, `ChatMessage`, `PROVIDERS` de
  `@/lib/llm`; `loadSettings`, `saveSettings`, `Settings`, `ProviderId` de
  `@/lib/settings`; `buildSystemPrompt` de `@/lib/context`; `MicroLabel`.
- Produces:
  - `<ChatPanel projects={ClientProject[]} />`
  - `<SettingsDialog onClose={(s: Settings) => void} />`
  - O evento `spider:transcript` (CustomEvent com `detail: string`) é o canal
    por onde a Tarefa 9 injeta o texto transcrito no input.

- [ ] **Step 1: Escrever o diálogo de configurações**

`src/components/SettingsDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PROVIDERS } from "@/lib/llm";
import { loadSettings, saveSettings, type ProviderId, type Settings } from "@/lib/settings";
import { MicroLabel } from "@/components/hud/MicroLabel";

export function SettingsDialog({ onClose }: { onClose: (s: Settings) => void }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const provider = PROVIDERS[settings.provider];

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-void-deep/90 p-4">
      <div className="hud-frame w-full max-w-sm p-4">
        <div className="mb-4">
          <MicroLabel tone="ember">configuração</MicroLabel>
        </div>

        <label className="mb-3 block">
          <MicroLabel>provedor</MicroLabel>
          <select
            value={settings.provider}
            onChange={(e) => {
              const id = e.target.value as ProviderId;
              setSettings({ ...settings, provider: id, model: PROVIDERS[id].models[0] ?? "" });
            }}
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 text-sm text-ink"
          >
            {Object.entries(PROVIDERS).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <MicroLabel>modelo</MicroLabel>
          <select
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
          >
            {provider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 block">
          <MicroLabel>key de {provider.label}</MicroLabel>
          <input
            type="password"
            value={settings.keys[settings.provider]}
            onChange={(e) =>
              setSettings({
                ...settings,
                keys: { ...settings.keys, [settings.provider]: e.target.value },
              })
            }
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
            placeholder="sk-..."
          />
          <span className="mt-1 block text-[10px] text-ink-faint">
            guardada em texto puro no perfil desta máquina
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            saveSettings(settings);
            onClose(settings);
          }}
          className="w-full border border-red px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-red hover:bg-red hover:text-void-deep"
        >
          salvar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Escrever o painel de chat**

`src/components/ChatPanel.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientProject } from "@/types/project";
import { streamChat, MissingKeyError, type ChatMessage } from "@/lib/llm";
import { loadSettings, type Settings } from "@/lib/settings";
import { buildSystemPrompt } from "@/lib/context";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { SettingsDialog } from "@/components/SettingsDialog";

export function ChatPanel({ projects }: { projects: ClientProject[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const fimDaLista = useRef<HTMLDivElement>(null);

  // loadSettings toca localStorage, que não existe no passe de servidor do
  // export estático — por isso só depois da montagem.
  useEffect(() => setSettings(loadSettings()), []);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // A Tarefa 9 despacha este evento quando termina de transcrever.
  useEffect(() => {
    function receber(e: Event) {
      const texto = (e as CustomEvent<string>).detail;
      if (texto) setInput((atual) => (atual ? `${atual} ${texto}` : texto));
    }
    window.addEventListener("spider:transcript", receber);
    return () => window.removeEventListener("spider:transcript", receber);
  }, []);

  async function enviar() {
    const pergunta = input.trim();
    if (!pergunta || streaming || !settings) return;

    setInput("");
    setErro(null);
    setStreaming(true);

    const historico: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(projects) },
      ...messages,
      { role: "user", content: pergunta },
    ];

    setMessages((m) => [
      ...m,
      { role: "user", content: pergunta },
      { role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    try {
      for await (const pedaco of streamChat(historico, settings, controller.signal)) {
        setMessages((m) => {
          const copia = [...m];
          const ultima = copia[copia.length - 1];
          if (ultima?.role === "assistant") {
            copia[copia.length - 1] = { role: "assistant", content: ultima.content + pedaco };
          }
          return copia;
        });
      }
    } catch (e) {
      if (e instanceof MissingKeyError) setConfigurando(true);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <MicroLabel tone="ember">conversa</MicroLabel>
        <button type="button" onClick={() => setConfigurando(true)}>
          <MicroLabel>{settings?.model ?? "configurar"}</MicroLabel>
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-ink-muted">
            Pergunte o que está pegando. Eu leio o estado dos projetos — não executo nada.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <MicroLabel tone={m.role === "user" ? "faint" : "ember"}>
              {m.role === "user" ? "você" : "spider"}
            </MicroLabel>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {m.content}
              {streaming && i === messages.length - 1 && (
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-red align-middle" />
              )}
            </p>
          </div>
        ))}
        {erro && <p className="text-xs leading-relaxed text-danger">{erro}</p>}
        <div ref={fimDaLista} />
      </div>

      <div className="border-t border-line p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          rows={2}
          placeholder="perguntar ou segurar o core pra falar…"
          className="w-full resize-none border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-red focus:outline-none"
        />
      </div>

      {configurando && (
        <SettingsDialog
          onClose={(s) => {
            setSettings(s);
            setConfigurando(false);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Testar de ponta a ponta**

Run: `npm run typecheck` — sem erros.

Run: `npm run dev`, abra `localhost:3000`, clique no rótulo do modelo, cole a
key do OpenRouter, salve, e pergunte "quais projetos pedem atenção?".

Esperado: a resposta aparece palavra por palavra e cita Neon e Sorris (dado
mockado do `lib/tauri.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatPanel.tsx src/components/SettingsDialog.tsx
git commit -m "feat: painel de chat com streaming e configuracao de provedor"
```

---

### Task 9: Voz — gravar, transcrever, injetar

**Files:**
- Create: `src/lib/voice.ts`
- Create: `src/components/VoiceCore.tsx`

**Interfaces:**
- Consumes: `Ring`, `RingState`, `MicroLabel`, `loadSettings`, `Settings`.
- Produces:
  - `interface Recording { stop(): Promise<Blob> }`
  - `startRecording(onLevel: (n: number) => void): Promise<Recording>`
  - `transcribe(audio: Blob, settings: Settings): Promise<string>`
  - `speak(texto: string): void`
  - `<VoiceCore />` — o core central com push-to-talk.

- [ ] **Step 1: Confirmar o endpoint de ASR antes de escrever código**

O spec deixa isso em aberto de propósito. Rode, trocando `$KEY` pela key da
NVIDIA e usando qualquer `.wav` curto:

```bash
curl -s -o resposta.json -w "%{http_code}\n" \
  https://integrate.api.nvidia.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $KEY" \
  -F file=@teste.wav \
  -F model=nvidia/parakeet-ctc-1.1b-asr
cat resposta.json
```

- 200 com `{"text": "..."}` → siga, usando a URL e o modelo que responderam.
- 404 ou erro de modelo → o ASR dessa conta é Riva/gRPC, não
  OpenAI-compatible. **Não improvise**: a interface `blob → texto` continua,
  só troca o provedor. Avise o dono e proponha Groq Whisper
  (`https://api.groq.com/openai/v1/audio/transcriptions`, tier gratuito, mesmo
  formato multipart) — é troca de `ASR_URL` e `ASR_MODEL` dentro de
  `voice.ts`, mais uma key nova em `settings.ts`.

- [ ] **Step 2: Escrever voice.ts**

`src/lib/voice.ts`:

```ts
import type { Settings } from "./settings.ts";

export interface Recording {
  stop(): Promise<Blob>;
}

const ASR_URL = "https://integrate.api.nvidia.com/v1/audio/transcriptions";
const ASR_MODEL = "nvidia/parakeet-ctc-1.1b-asr";

/**
 * Grava do microfone e reporta o nível de volume em tempo real (0..1) — é
 * isso que faz o anel do core respirar enquanto se fala.
 */
export async function startRecording(onLevel: (level: number) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const contexto = new AudioContext();
  const analisador = contexto.createAnalyser();
  analisador.fftSize = 256;
  contexto.createMediaStreamSource(stream).connect(analisador);

  const amostras = new Uint8Array(analisador.frequencyBinCount);
  let rodando = true;

  function medir() {
    if (!rodando) return;
    analisador.getByteTimeDomainData(amostras);
    let soma = 0;
    for (const amostra of amostras) {
      const desvio = (amostra - 128) / 128;
      soma += desvio * desvio;
    }
    onLevel(Math.min(1, Math.sqrt(soma / amostras.length) * 4));
    requestAnimationFrame(medir);
  }
  medir();

  const gravador = new MediaRecorder(stream, { mimeType: "audio/webm" });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size > 0) pedacos.push(e.data);
  };
  gravador.start();

  return {
    stop() {
      return new Promise<Blob>((resolve) => {
        gravador.onstop = () => {
          rodando = false;
          onLevel(0);
          stream.getTracks().forEach((t) => t.stop());
          void contexto.close();
          resolve(new Blob(pedacos, { type: "audio/webm" }));
        };
        gravador.stop();
      });
    },
  };
}

export async function transcribe(audio: Blob, settings: Settings): Promise<string> {
  const key = settings.keys.nvidia;
  if (!key) throw new Error("configure a key da NVIDIA NIM para usar a voz");

  const form = new FormData();
  form.append("file", audio, "fala.webm");
  form.append("model", ASR_MODEL);

  const resposta = await fetch(ASR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!resposta.ok) throw new Error(`transcrição falhou (${resposta.status})`);

  const { text } = (await resposta.json()) as { text?: string };
  return text?.trim() ?? "";
}

/** TTS nativa do WebView2 — nenhuma dependência, nenhuma chamada de rede. */
export function speak(texto: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  const vozPtBr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("pt"));
  if (vozPtBr) fala.voice = vozPtBr;
  window.speechSynthesis.speak(fala);
}
```

- [ ] **Step 3: Escrever o VoiceCore**

`src/components/VoiceCore.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { Ring, type RingState } from "@/components/hud/Ring";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { startRecording, transcribe, type Recording } from "@/lib/voice";
import { loadSettings } from "@/lib/settings";

export function VoiceCore() {
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<RingState>("idle");
  const [aviso, setAviso] = useState<string | null>(null);
  const gravacao = useRef<Recording | null>(null);

  async function comecar() {
    if (gravacao.current) return;
    setAviso(null);
    try {
      gravacao.current = await startRecording(setLevel);
      setState("listening");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "microfone indisponível");
    }
  }

  async function terminar() {
    const atual = gravacao.current;
    if (!atual) return;
    gravacao.current = null;
    setState("thinking");

    try {
      const audio = await atual.stop();
      const texto = await transcribe(audio, loadSettings());
      if (texto) {
        window.dispatchEvent(new CustomEvent("spider:transcript", { detail: texto }));
      } else {
        setAviso("não entendi");
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "falha ao transcrever");
    } finally {
      setState("idle");
      setLevel(0);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onPointerDown={() => void comecar()}
        onPointerUp={() => void terminar()}
        onPointerLeave={() => void terminar()}
        aria-label="segure para falar"
        className="rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        <Ring level={level} state={state} size={280} />
      </button>

      <MicroLabel tone={state === "idle" ? "faint" : "ember"}>
        {state === "listening"
          ? "ouvindo"
          : state === "thinking"
            ? "transcrevendo"
            : "segure para falar"}
      </MicroLabel>

      {aviso && <p className="max-w-[240px] text-center text-xs text-danger">{aviso}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Testar no app nativo**

Run: `npm run app:dev`

Segure o core, fale "quais projetos estão fora do ar", solte.

Esperado: o anel interno respira enquanto se fala; ao soltar, o texto
transcrito aparece no campo do chat à direita.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voice.ts src/components/VoiceCore.tsx
git commit -m "feat: push-to-talk com transcricao e anel reativo ao microfone"
```

---

### Task 10: Spider responde falando

**Files:**
- Modify: `src/components/ChatPanel.tsx`

**Interfaces:**
- Consumes: `speak` de `@/lib/voice`.
- Produces: nada novo — fecha o ciclo de voz.

- [ ] **Step 1: Falar quando a resposta terminar**

Em `ChatPanel.tsx`, importe `speak`:

```tsx
import { speak } from "@/lib/voice";
```

Adicione o estado do interruptor, junto dos outros `useState`:

```tsx
  const [falar, setFalar] = useState(false);
```

E troque o bloco `try` do `enviar()` para acumular a resposta e falar no fim:

```tsx
    let completa = "";
    try {
      for await (const pedaco of streamChat(historico, settings, controller.signal)) {
        completa += pedaco;
        setMessages((m) => {
          const copia = [...m];
          const ultima = copia[copia.length - 1];
          if (ultima?.role === "assistant") {
            copia[copia.length - 1] = { role: "assistant", content: ultima.content + pedaco };
          }
          return copia;
        });
      }
      if (falar && completa) speak(completa);
    } catch (e) {
```

- [ ] **Step 2: Botão de ligar e desligar a fala**

No cabeçalho do painel, entre o `MicroLabel` de "conversa" e o botão do
modelo:

```tsx
        <button type="button" onClick={() => setFalar((v) => !v)} aria-pressed={falar}>
          <MicroLabel tone={falar ? "ember" : "faint"}>
            {falar ? "voz ligada" : "voz muda"}
          </MicroLabel>
        </button>
```

- [ ] **Step 3: Testar**

Run: `npm run app:dev`

Ligue "voz", pergunte qualquer coisa. Esperado: a resposta é lida em voz alta
em português quando o streaming termina.

- [ ] **Step 4: Rodar tudo**

Run: `npm test` — 20 testes passando.

Run: `npm run typecheck` — sem erros.

Run: `npm run build` — export estático compila.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: leitura em voz alta da resposta"
```

---

## O que este plano deliberadamente não faz

- Coletor de Coolify e de Asaas — `hosting` e `billing` seguem `null`.
- Qualquer execução de comando pelo chat.
- Wake word e escuta contínua.
- Histórico de conversa persistido entre sessões.
- Descoberta dinâmica do catálogo de modelos.
- Ícone definitivo do app: o atual é um placeholder gerado nesta sessão.
