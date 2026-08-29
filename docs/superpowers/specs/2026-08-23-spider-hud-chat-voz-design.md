# Spider — HUD, chat e voz

Data: 2026-08-23
Status: aprovado para plano de implementação

## Problema

O Spider hoje é um painel de status de leitura passiva: cards de projeto
alimentados por um coletor de git em Rust. Faltam duas coisas que o dono
pediu, e a interface atual não é a que ele quer.

1. **Não dá pra perguntar nada.** Ver que "Sorris tem 12 arquivos sujos" é
   diferente de perguntar "o que pegou essa semana?" e receber a leitura
   cruzada de git, hosting e cobrança.
2. **Não dá pra falar.** O uso real é de relance, entre uma tarefa e outra —
   digitar compete com o trabalho, falar não.
3. **A interface está mono demais.** Fonte monoespaçada em prosa e label dão
   cara de log de terminal. A direção desejada é HUD sci-fi: anéis
   concêntricos, hairlines vermelhas, micro-labels em sans com tracking
   largo, glow contido.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Papel do chat | Conversar sobre os projetos, **sem executar ações** | Zero risco de estragar repositório. O modelo lê estado e responde. |
| Backend LLM | OpenRouter + NVIDIA NIM, modelos gratuitos | Ambos são OpenAI-compatible: um cliente só, `baseUrl` trocável. |
| Onde a API é chamada | Frontend (webview), key em `localStorage` | App single-user local com key free-tier. Proxy em Rust dobra o código sem ganho proporcional. Migração futura toca só `lib/llm.ts`. |
| Voz | STT via ASR da NIM + TTS nativa do Windows | WebView2 não tem `SpeechRecognition`; `speechSynthesis` ele tem. |
| Layout | Três colunas: cards · core · chat | Reconcilia "chat lateral fixo" com "core central grande" da referência. |
| Tipografia | Saira (display/labels), Inter (corpo), Plex Mono (só dado técnico) | Resolve a queixa de "mono em tudo" sem perder densidade técnica. |

## Linguagem visual

Extraída da referência como sistema, não como imagem:

- **Fundo** `#050506` com vinheta radial. O vermelho só funciona porque o
  entorno é vazio.
- **Anéis concêntricos** em SVG: círculos tracejados, ticks radiais, arcos
  parciais, pontos-nó com glow.
- **Micro-labels**: uppercase, 9–10px, tracking ~0.25em, `--color-ink-muted`.
  É daí que vem a densidade técnica — em sans, não em mono.
- **Wordmark**: SPIDER em Saira com tracking muito aberto.
- **Moldura de canto**: o `.hud-frame` atual já é isso; endurece.
- **Glow**: `box-shadow`/`drop-shadow` com blur grande derruba o FPS no
  WebView2. Glow real só em poucos pontos-chave; o resto simulado com
  `radial-gradient`, que é barato.

### O core é funcional, não decorativo

O anel central é o **botão de push-to-talk**. Seus arcos reagem ao nível do
microfone via `AnalyserNode` enquanto o usuário fala, e giram devagar
enquanto o modelo responde. É o elemento mais bonito da tela e o indicador
de estado ao mesmo tempo.

### Responsivo

Abaixo de ~1100px de largura o core colapsa para um anel pequeno no header e
o layout vira duas colunas (cards · chat). Janela mínima já configurada:
960×640.

## Arquitetura

```
src/lib/llm.ts          → cliente OpenAI-compatible (OpenRouter | NIM)
src/lib/voice.ts        → MediaRecorder → ASR NIM; speechSynthesis
src/lib/settings.ts     → keys + provider + modelo em localStorage
src/components/hud/     → Ring, CornerFrame, MicroLabel, Hairline
src/components/ChatPanel.tsx
src/components/VoiceCore.tsx
```

### Chat

Um cliente só. OpenRouter (`https://openrouter.ai/api/v1`) e NVIDIA NIM
(`https://integrate.api.nvidia.com/v1`) falam o mesmo protocolo
`/chat/completions`, então o provider é `baseUrl` + key + lista de modelos.

A lista de modelos gratuitos é um array editável no código — sem descoberta
dinâmica de catálogo nesta fatia.

Contexto: o JSON dos projetos que o painel já tem em mãos, injetado como
system message a cada turno. Sem RAG, sem histórico persistido — a conversa
morre ao fechar o app. Nenhuma tool, nenhuma execução.

Streaming via SSE com `fetch` + `ReadableStream`.

### Voz

- **Ouvir**: `MediaRecorder` grava webm/opus, POST para o endpoint ASR da
  NIM, texto cai no input. Push-to-talk (segura, fala, solta) — sem wake
  word, sem escuta contínua.
- **Falar**: `speechSynthesis` do WebView2 com voz pt-BR do Windows.

**A verificar antes de codar:** o nome e o formato exatos do endpoint ASR
da NVIDIA (modelos parakeet/canary) — se aceita upload de arquivo direto ou
exige gRPC/Riva. Se exigir Riva, o STT muda de fornecedor, não de desenho: a
interface de `lib/voice.ts` continua `blob -> texto`.

**Risco conhecido:** o WebView2 exige que o app trate o pedido de permissão
de microfone, e o Tauri v2 não faz isso sozinho em toda versão. Se
`getUserMedia` for negado, o plano B é gravar no Rust com a crate `cpal` —
cerca de meio dia a mais. Isso é a **primeira coisa a verificar** na
implementação, antes de escrever a UI de voz.

### Segurança

A key da API vive em `localStorage` do WebView2 (`%LOCALAPPDATA%`), em texto
puro. Aceito conscientemente: app local, single-user, key de tier gratuito.
Quem lê o perfil do usuário lê a key — mesma superfície do resto do perfil.
Se a key virar paga, migrar para Windows Credential Manager via Rust,
trocando apenas `lib/settings.ts`.

Nenhuma tool de execução é exposta ao modelo. O pior caso de um prompt
malicioso vindo de um nome de branch é texto errado na tela.

## Testes

- `lib/status.ts` já é pura e testável; manter.
- `lib/llm.ts`: teste do parser de SSE com um stream fabricado (chunk
  partido no meio de um `data:` é o caso que quebra implementações ingênuas).
- Verificação manual: app abre, core responde ao microfone, resposta
  streama, TTS fala.

## Fora de escopo nesta fatia

- Coletor Coolify (hosting) e Asaas (cobrança) — seguem `null`.
- Execução de comandos pelo chat.
- Wake word / escuta contínua.
- Histórico de conversa persistido.
- Descoberta dinâmica do catálogo de modelos.

## Pendência de ambiente

O coletor Rust exige a env `SPIDER_PROJECTS_ROOT` apontando para a pasta que
contém as pastas dos clientes. Sem ela o app abre com erro em todos os
cards. Definir antes de testar com dado real.
