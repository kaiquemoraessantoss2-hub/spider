# Spider

Painel de status dos projetos e clientes. Primeira fatia do plano maior
(voz + modo CMD via Orca virão depois em cima disso).

## O que já funciona

- **Frontend Next.js 16 + Tailwind v4**: testei com `next build` real neste
  ambiente — compila limpo, type-check sem erros (`noUncheckedIndexedAccess`
  incluso). Rode `npm run dev` e abra `localhost:3000` no navegador pra ver
  o painel com dados mockados, sem precisar do Rust compilado ainda.
- **Coletor de git** (`src-tauri/src/commands/git.rs`): varre cada pasta de
  cliente, roda `git` via `Command` (não usa a crate `git2`, só o binário
  do sistema — menos dependência nativa pra compilar), extrai branch,
  arquivos sujos, commits não enviados, e o último commit.
- **Hand-off pro Orca** (`src-tauri/src/commands/orca.rs`): botão "Abrir no
  Orca" no card chama `orca worktree create --path <pasta>`.

## O que eu NÃO consegui testar

Este ambiente não tem Rust/Cargo instalado, então o lado Tauri está escrito
correto até onde eu sei, mas **não compilei de verdade**. Antes de confiar
nele, rode na sua máquina:

```bash
npm install
npm run app:dev
```

Se `cargo tauri dev` reclamar de alguma coisa, é o primeiro lugar a olhar.

Duas coisas que eu marquei explicitamente como "verificar" no código:

1. **`orca worktree create --path <pasta>`** — não consegui buscar a
   referência completa da CLI do Orca (`orca --help`), então escrevi essa
   chamada com base no que apareceu em reviews e na doc de orquestração.
   Rode `orca worktree --help` na sua máquina e ajusta os argumentos em
   `commands/orca.rs` se o nome do flag for outro.
2. **Ícones do app** — removi a seção `icon` do `tauri.conf.json` porque eu
   não tinha um arquivo de ícone real pra apontar. Rode
   `npx tauri icon caminho/para/seu-logo.png` quando tiver uma logo do
   Spider — isso gera a pasta `icons/` inteira e você só precisa
   readicionar a chave `bundle.icon` no config.

## Como configurar

O coletor de git precisa saber onde ficam as pastas dos seus clientes:

```bash
export SPIDER_PROJECTS_ROOT=/caminho/para/sua/pasta/de/projetos
npm run app:dev
```

Isso conecta direto com a ideia que você já tinha de juntar tudo numa pasta
raiz única — é essa pasta que o `SPIDER_PROJECTS_ROOT` deve apontar.

Cada subpasta vira um card. O nome do card vem do nome da pasta
("wcj-instalacoes" → "Wcj Instalacoes") a menos que você crie um
`.spider.json` dentro da pasta do projeto:

```json
{
  "display_name": "WCJ Instalações Hidráulicas e Elétricas",
  "brand": "koder"
}
```

## O que ainda não existe (de propósito, é a próxima fatia)

- Coletor do Coolify (saúde de deploy) — `hosting` sempre vem `null` por
  enquanto, o card já trata esse estado ("não configurado").
- Coletor do Asaas (cobrança) — mesma coisa, `billing` sempre `null`.
- Comando de voz.
- Modo CMD com terminais PTY próprios — decidimos delegar isso ao Orca em
  vez de reimplementar.

## Estrutura

```
src/                    → frontend Next.js (roda em localhost:3000 em dev)
  app/page.tsx           → dashboard principal
  components/            → ProjectCard, StatusDot
  lib/status.ts           → lógica de tone (ok/warn/danger) — pura, sem UI
  lib/tauri.ts            → wrapper do invoke + mock de dados p/ dev no navegador
  types/project.ts        → tipos espelhando as structs Rust

src-tauri/               → backend Tauri (precisa compilar na sua máquina)
  src/commands/git.rs      → coletor de git
  src/commands/orca.rs     → hand-off pro Orca
  src/project.rs           → varre SPIDER_PROJECTS_ROOT e monta os cards
  src/main.rs               → registra os comandos
```
