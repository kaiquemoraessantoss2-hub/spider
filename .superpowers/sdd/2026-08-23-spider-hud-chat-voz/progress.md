# SDD ledger — plan: docs/superpowers/plans/2026-08-23-spider-hud-chat-voz.md

Spec: docs/superpowers/specs/2026-08-23-spider-hud-chat-voz-design.md (lida)
Repo: não era git; `git init` feito (autorizado pelo pré-requisito 1 do plano).
Branch: feat/hud-chat-voz, a partir de a6d6aed em main.

## Pré-flight: scan de conflitos

### Pares de tarefas que compartilham arquivo ou interface

| A | B | Produz → Consome | Achado |
|---|---|---|---|
| T1 | T7 | `page.tsx`: T1 insere botão temporário, T7 reescreve | OK — T1 remove o próprio código no step 4 |
| T2 | T3 | `SSEBuffer.push()` → `streamChat` | OK — assinatura idêntica |
| T3 | T8 | `PROVIDERS`, `streamChat`, `MissingKeyError`, `ChatMessage` → ChatPanel/SettingsDialog | OK |
| T3 | T9 | `Settings.keys.nvidia` → `transcribe` | OK — `Record<ProviderId,string>` cobre |
| T4 | T8 | `buildSystemPrompt(projects)` → historico system message | OK |
| T5 | T7,T8,T9 | `MicroLabel`, tokens `--color-void-deep`/`--font-display` | OK |
| T6 | T9 | `Ring`, `RingState` → VoiceCore | OK — T6 exporta `RingState` explicitamente |
| T7 | T8,T9 | `page.tsx` importa `ChatPanel` e `VoiceCore` **antes de existirem** | **CONFLITO** — ver Ruling 1 |
| T8 | T9 | evento `spider:transcript` (CustomEvent<string>) | OK — nome e `detail` batem nos dois lados |
| T8 | T10 | bloco `try` de `enviar()` | OK — T10 mostra o bloco terminando em `} catch (e) {`, igual ao de T8 |
| T9 | T10 | `speak(texto)` → ChatPanel | OK |
| T2 | — | `package.json`, `tsconfig.json` | OK — só T2 toca |

### Auto-consistência de cada tarefa

| Tarefa | Teste vs. código que ela mesma especifica | Achado |
|---|---|---|
| T1 | spike, sem teste | OK |
| T2 | 7 testes contra `SSEBuffer`; import `./sse.ts` exige a flag do step 1 | OK |
| T4 | `/NÃO executa/` bate com "você NÃO executa nada"; `/Nenhum projeto/` bate; `doesNotMatch /null/` — nenhum campo do fixture imprime "null" | OK |
| T6 | `arcPath(10,0,90)` → `M 0 -10` e `A 10 10 0 0 1 10 0`; 2º de 4 ticks em 90° → (10,0) | OK — geometria confere |
| T5 | `.font-display` manual duplica o utilitário que o Tailwind v4 gera de `--font-display`; `.hud-glow-node` não é usada por nenhuma tarefa | **CONFLITO** — ver Rulings 2 e 3 |
| T7 | contagem de colunas vs. breakpoint | OK — corrigido para `min-[1100px]` antes da execução |
| T9 | `for..of` em `Uint8Array` com target ES2022 | OK |
| T10 | edita bloco criado em T8 | OK |

### Rulings de pré-flight

**Ruling 1 — T7 não importa componentes que ainda não existem.** O plano
mandava T7 importar `ChatPanel` e `VoiceCore` e "comentar as duas linhas"
para ver a tela. Isso deixa T7 não verificável por conta própria, o que o
gate de review exige. Decisão: T7 renderiza as duas colunas com um
`<MicroLabel>` de placeholder no lugar dos componentes; T8 e T9 substituem
o placeholder pelo próprio componente quando o criam. Custo se errado:
duas linhas de churn extra em `page.tsx` nas tarefas 8 e 9.

**Ruling 2 — remover a regra `.font-display` manual de T5.** No Tailwind v4
o token `--font-display` dentro de `@theme` já gera o utilitário
`font-display`; a regra CSS manual é redundante e cria uma segunda fonte de
verdade. Decisão: manter só o token. Custo se errado: se o utilitário não
for gerado, as classes `font-display` não aplicam a Saira e a regra volta —
detectável a olho nu na primeira tela da T5.

**Ruling 3 — remover `.hud-glow-node` de T5.** Nenhuma tarefa do plano a
consome; é código morto que o review vai marcar. Decisão: não escrever.
Custo se errado: se um brilho pontual fizer falta na T6/T9, são 5 linhas de
CSS de volta.

**Ruling 4 — T1 vira sonda automática em vez de alert + clique humano.** O
plano pedia um `alert()` e um humano lendo a janela do Tauri. Numa execução
por subagentes ninguém lê alert. Decisão: a sonda roda no `useEffect`, com
timeout de 15s, e grava o resultado num arquivo via um comando Rust
temporário `probe_log`; o agente lê o arquivo. Mesma decisão de saída
(webview vs. cpal), verificável sem humano. O código temporário — sonda e
comando Rust — é removido no fim da tarefa. Custo se errado: se o prompt de
permissão do WebView2 aparecer e ninguém clicar, o resultado é TIMEOUT, que
é informação legítima (permissão não é automática) e não um falso OK.

---

## Progresso

- **Tarefa 1 (spike microfone) — concluída.** Sonda automática (Ruling 4)
  rodou no WebView2 real via `npm run app:dev`. Resultado gravado em
  `probe-mic.txt`: `OK: Padrão - Microfone (Realtek(R) Audio)`. Decisão:
  captura de áudio segue no webview via `getUserMedia`; **não é necessário
  migrar para `cpal`** no Rust. Tarefas 9 e 10 seguem válidas como
  planejadas. Código temporário (sonda no frontend + comando `probe_log`)
  removido por completo — `git status` limpo antes deste commit. Relatório
  completo em `task-1-report.md`.
