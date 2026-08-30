"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientProject } from "@/types/project";
import { streamChat, MissingKeyError, type ChatMessage } from "@/lib/llm";
import { loadSettings, type Settings } from "@/lib/settings";
import { buildSystemPrompt } from "@/lib/context";
import { speak, calar, TRANSCRIPT_EVENT } from "@/lib/voice";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { SettingsDialog } from "@/components/SettingsDialog";

export function ChatPanel({ projects }: { projects: ClientProject[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [falar, setFalar] = useState(false);
  const fimDaLista = useRef<HTMLDivElement>(null);
  // Guarda o controller do stream em curso pra "nova conversa" (M8) e o
  // timeout (I1) conseguirem alcançá-lo de fora de enviar().
  const controllerRef = useRef<AbortController | null>(null);

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
    window.addEventListener(TRANSCRIPT_EVENT, receber);
    return () => window.removeEventListener(TRANSCRIPT_EVENT, receber);
  }, []);

  function novaConversa() {
    // As três coisas que "limpar a conversa" precisa fazer de verdade:
    // parar o stream em curso, calar a fala e zerar o histórico — sem isso
    // o histórico reenviado a cada turno só cresce (contexto do modelo
    // gratuito estoura) e a fala não tem como ser interrompida.
    controllerRef.current?.abort();
    calar();
    setMessages([]);
    setErro(null);
  }

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
    controllerRef.current = controller;
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
      // Fala uma vez só, com a resposta completa — chamar speak() a cada
      // pedaço do streaming corta a fala no WebView2 a cada token.
      if (falar && completa) speak(completa);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // Cancelamento intencional ("nova conversa") — não é erro pra mostrar.
        return;
      }
      if (e instanceof MissingKeyError) setConfigurando(true);
      const semResposta = e instanceof DOMException && e.name === "TimeoutError";
      setErro(semResposta ? "o servidor parou de responder — tente de novo" : e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <MicroLabel tone="ember">conversa</MicroLabel>
          <button type="button" onClick={novaConversa}>
            <MicroLabel tone="faint">nova conversa</MicroLabel>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setFalar((v) => {
                const ligar = !v;
                if (!ligar) calar();
                return ligar;
              })
            }
            aria-pressed={falar}
          >
            <MicroLabel tone={falar ? "ember" : "faint"}>
              {falar ? "voz ligada" : "voz muda"}
            </MicroLabel>
          </button>
          <button type="button" onClick={() => setConfigurando(true)}>
            <MicroLabel>{settings?.model ?? "configurar"}</MicroLabel>
          </button>
        </div>
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
            <p
              className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink"
              aria-live={m.role === "assistant" ? "polite" : undefined}
            >
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
            // Cancelamento (Esc/backdrop/botão cancelar) chama onClose() sem
            // argumento — não pode propagar alteração nenhuma nas settings.
            if (s) setSettings(s);
            setConfigurando(false);
          }}
        />
      )}
    </div>
  );
}
