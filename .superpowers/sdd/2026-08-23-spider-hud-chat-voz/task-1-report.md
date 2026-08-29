# Tarefa 1 — Spike: o microfone funciona no WebView2? — Relatório

## Resultado da sonda

Conteúdo exato de `probe-mic.txt`:

```
OK: Padrão - Microfone (Realtek(R) Audio)
```

## Decisão

**O WebView2 serve.** `navigator.mediaDevices.getUserMedia({ audio: true })`
concedeu acesso ao microfone dentro da janela nativa do Tauri, sem erro e
sem estourar o timeout de 15s. **Não é necessário migrar a captura de áudio
para a crate `cpal` no Rust.** As Tarefas 9 e 10 seguem válidas como
planejadas, usando `getUserMedia` no frontend.

## Método (adaptado conforme a resolução de ambiguidade recebida)

O brief original (`task-1-brief.md`) pedia um botão + `alert()` + clique
humano na janela do Tauri. Como esta execução roda por subagente, sem
humano observando a janela, o método foi substituído por uma sonda
automática, mantendo a mesma decisão de saída (webview vs. cpal):

1. **Frontend temporário** — em `src/app/page.tsx`, um hook `useMicProbe()`
   chamado no `useEffect` de montagem do `Home`. Ele corre
   `navigator.mediaDevices.getUserMedia({ audio: true })` numa
   `Promise.race` contra um timeout de 15000ms, produzindo uma destas três
   strings:
   - `OK: <label da faixa de áudio>` — permissão concedida;
   - `FALHOU: <erro>` — permissão negada ou API ausente;
   - `TIMEOUT` — sem resposta em 15s (prompt de permissão que ninguém
     respondeu; não conta como OK).

   O resultado foi enviado via `invoke("probe_log", { result })`, importando
   `invoke` de `@tauri-apps/api/core` (import dinâmico, no mesmo padrão já
   usado em `src/lib/tauri.ts`).

2. **Comando Rust temporário** — em `src-tauri/src/main.rs`, adicionado:

   ```rust
   #[tauri::command]
   fn probe_log(result: String) -> Result<(), String> {
       std::fs::write("probe-mic.txt", result).map_err(|e| e.to_string())
   }
   ```

   registrado em `tauri::generate_handler![list_projects, open_in_orca, probe_log]`.

3. **Execução** — comando rodado a partir da raiz do projeto:

   ```
   npm run app:dev
   ```

   (em background). O build do Rust já estava quente; ainda assim recompilou
   em ~44.8s (`Finished 'dev' profile ... in 44.81s`) porque `main.rs` foi
   modificado. Em seguida o binário `target\debug\spider.exe` subiu, a
   página `/` carregou (`GET / 200`), a sonda rodou sozinha no `useEffect` e
   gravou o arquivo.

   **Observação de instrumentação:** o arquivo não apareceu na raiz do
   projeto, e sim em `src-tauri/probe-mic.txt` — o processo `cargo run`
   iniciado pelo `tauri dev` roda com cwd em `src-tauri/`, então
   `std::fs::write("probe-mic.txt", ...)` (caminho relativo, conforme
   especificado literalmente no requisito) resolveu ali. O arquivo foi
   localizado e lido normalmente; não foi necessário alterar o código do
   comando (o requisito pedia o caminho relativo literal).

   O processo `npm run app:dev` encerrou sozinho (exit code 0) logo após a
   sonda gravar o resultado — não houve necessidade de encerrá-lo
   manualmente; nenhuma etapa da tarefa dependia de mantê-lo rodando além
   desse ponto.

4. **Limpeza** — removidos integralmente:
   - o hook `useMicProbe` e seu `useEffect` em `src/app/page.tsx` (arquivo
     restaurado ao estado original);
   - o comando `probe_log` e seu registro no `invoke_handler` em
     `src-tauri/src/main.rs` (arquivo restaurado ao estado original);
   - o arquivo `probe-mic.txt` (em `src-tauri/`).

   Confirmado com `git status` / `git diff --stat`: working tree limpo antes
   de qualquer commit — nenhum código de produção foi alterado por este
   spike.

## Arquivos tocados durante o spike (todos revertidos)

- `C:\Users\kaique\Downloads\spider\spider\src\app\page.tsx` (temporário, revertido)
- `C:\Users\kaique\Downloads\spider\spider\src-tauri\src\main.rs` (temporário, revertido)
- `C:\Users\kaique\Downloads\spider\spider\src-tauri\probe-mic.txt` (temporário, apagado)

## Arquivos permanentes deste commit

- `C:\Users\kaique\Downloads\spider\spider\.superpowers\sdd\2026-08-23-spider-hud-chat-voz\task-1-report.md` (este relatório)
- `C:\Users\kaique\Downloads\spider\spider\.superpowers\sdd\2026-08-23-spider-hud-chat-voz\progress.md` (ledger atualizado com a conclusão da Tarefa 1)
