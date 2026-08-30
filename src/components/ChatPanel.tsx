"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientProject } from "@/types/project";
import { streamChat, MissingKeyError, type ChatMessage } from "@/lib/llm";
import { loadSettings, type Settings } from "@/lib/settings";
import {
  listarConversas,
  carregarConversa,
  salvarConversa,
  apagarConversa,
  idAtual,
  definirAtual,
  novoId,
  type Conversa,
} from "@/lib/conversas";
import { buildSystemPrompt } from "@/lib/context";
import { speak, calar, TRANSCRIPT_EVENT } from "@/lib/voice";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { SettingsDialog } from "@/components/SettingsDialog";

export function ChatPanel({ projects }: { projects: ClientProject[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Só depois da montagem: o passe estático do Next não tem localStorage.
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaId, setConversaId] = useState<string>("");
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
    const lista = listarConversas();
    // Reabre onde parou: a última em uso, ou a mais recente. Só cria conversa
    // nova quando não há nenhuma — abrir o app não pode gerar conversa vazia.
    const salvo = idAtual();
    const id = (salvo && lista.some((c) => c.id === salvo) ? salvo : lista[0]?.id) ?? novoId();
    setConversas(lista);
    setConversaId(id);
    setMessages(carregarConversa(id));
    setHistoricoCarregado(true);
  }, []);

  // Grava a cada mudança, inclusive durante o streaming — fechar o app no
  // meio de uma resposta preserva o que já tinha chegado. A guarda evita
  // que o estado vazio do primeiro render apague o histórico salvo.
  useEffect(() => {
    if (!historicoCarregado || !conversaId) return;
    salvarConversa(conversaId, messages);
    definirAtual(conversaId);
    setConversas(listarConversas());
  }, [messages, historicoCarregado, conversaId]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // O listener é registrado uma vez só, mas `enviar` fecha sobre estado que
  // muda a cada render (settings, messages, streaming). Sem a ref, a fala
  // seria enviada com um retrato velho da conversa.
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;

  // Fecha o ciclo de voz: o VoiceCore despacha o texto transcrito e a
  // pergunta vai embora sozinha. Encher o campo e esperar um Enter fazia a
  // tela parecer morta pra quem acabou de falar.
  useEffect(() => {
    function receber(e: Event) {
      const texto = (e as CustomEvent<string>).detail;
      if (texto) void enviarRef.current(texto, true);
    }
    window.addEventListener(TRANSCRIPT_EVENT, receber);
    return () => window.removeEventListener(TRANSCRIPT_EVENT, receber);
  }, []);

  function trocarConversa(id: string) {
    controllerRef.current?.abort();
    calar();
    setErro(null);
    setConversaId(id);
    setMessages(carregarConversa(id));
  }

  function apagarAtual() {
    controllerRef.current?.abort();
    calar();
    apagarConversa(conversaId);
    const restantes = listarConversas();
    setConversas(restantes);
    const proxima = restantes[0]?.id ?? novoId();
    setConversaId(proxima);
    setMessages(carregarConversa(proxima));
    setErro(null);
  }

  function novaConversa() {
    // As três coisas que "limpar a conversa" precisa fazer de verdade:
    // parar o stream em curso, calar a fala e zerar o histórico — sem isso
    // o histórico reenviado a cada turno só cresce (contexto do modelo
    // gratuito estoura) e a fala não tem como ser interrompida.
    controllerRef.current?.abort();
    calar();
    // Conversa nova não apaga a anterior: ela ganha um id próprio e a antiga
    // continua na lista. A de antes zerava o histórico para sempre.
    const id = novoId();
    setConversaId(id);
    setMessages([]);
    setErro(null);
  }

  async function enviar(texto: string, porVoz = false) {
    const pergunta = texto.trim();
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
      // Pergunta feita por voz é respondida por voz, mesmo com o
      // interruptor desligado: quem falou não está olhando pra tela.
      if ((falar || porVoz) && completa) {
        const via = await speak(completa, settings);
        // Avisar da queda importa: sem isso, a voz muda de timbre no meio do
        // dia e o dono fica sem saber que o crédito da ElevenLabs acabou.
        if (via === "sistema" && settings.elevenVoiceId) {
          setErro("voz da ElevenLabs indisponível (crédito?) — falando com a voz do sistema");
        }
      }
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
        <div className="flex min-w-0 items-center gap-3">
          {/* Um select em vez de barra lateral: a coluna tem 380px, e uma
              lista fixa comeria o espaço da conversa em si. */}
          <select
            value={conversaId}
            onChange={(e) => trocarConversa(e.target.value)}
            aria-label="conversa"
            className="min-w-0 max-w-[150px] truncate border-none bg-transparent font-display text-[9px] uppercase tracking-[0.25em] text-red focus:outline-none"
          >
            {!conversas.some((c) => c.id === conversaId) && (
              <option value={conversaId}>conversa nova</option>
            )}
            {conversas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
          <button type="button" onClick={novaConversa} title="começar outra conversa">
            <MicroLabel tone="faint">nova</MicroLabel>
          </button>
          {messages.length > 0 && (
            <button type="button" onClick={apagarAtual} title="apagar esta conversa">
              <MicroLabel tone="faint">apagar</MicroLabel>
            </button>
          )}
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
              void enviar(input);
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
