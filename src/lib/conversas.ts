export interface Mensagem {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Conversa {
  id: string;
  titulo: string;
  atualizadaEm: number;
  mensagens: Mensagem[];
}

const CHAVE = "spider.conversas.v1";
const CHAVE_ATUAL = "spider.conversaAtual.v1";
/** Chave da versão de conversa única, migrada na primeira leitura. */
const CHAVE_ANTIGA = "spider.conversa.v1";

/** Teto de mensagens por conversa: o histórico inteiro é reenviado a cada
 *  turno e estoura o contexto dos modelos gratuitos antes de encher o disco. */
export const MAX_MENSAGENS = 40;
/** Teto de conversas guardadas, para o localStorage não crescer sem fim. */
export const MAX_CONVERSAS = 30;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Storage bloqueado pelo navegador: a sessão segue só em memória.
    return null;
  }
}

function ehMensagem(m: unknown): m is Mensagem {
  return (
    typeof m === "object" &&
    m !== null &&
    typeof (m as Mensagem).content === "string" &&
    ["system", "user", "assistant"].includes((m as Mensagem).role)
  );
}

/** Título tirado da primeira fala do usuário — ninguém quer batizar conversa
 *  à mão, e "Conversa 3" não ajuda a achar nada depois. */
export function tituloDe(mensagens: Mensagem[]): string {
  const primeira = mensagens.find((m) => m.role === "user")?.content.trim();
  if (!primeira) return "conversa nova";
  const limpa = primeira.replace(/\s+/g, " ");
  return limpa.length > 48 ? `${limpa.slice(0, 48)}…` : limpa;
}

export function novoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listarConversas(): Conversa[] {
  const s = storage();
  if (!s) return [];

  let lista: Conversa[] = [];
  try {
    const bruto: unknown = JSON.parse(s.getItem(CHAVE) ?? "[]");
    if (Array.isArray(bruto)) {
      lista = bruto
        .filter(
          (c): c is Conversa =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as Conversa).id === "string" &&
            Array.isArray((c as Conversa).mensagens),
        )
        .map((c) => ({
          id: c.id,
          titulo: typeof c.titulo === "string" ? c.titulo : "conversa",
          atualizadaEm: typeof c.atualizadaEm === "number" ? c.atualizadaEm : 0,
          mensagens: c.mensagens.filter(ehMensagem),
        }));
    }
  } catch {
    lista = [];
  }

  // Migração da versão de conversa única: quem já tinha um histórico não pode
  // perdê-lo só porque o formato virou lista.
  try {
    const antiga: unknown = JSON.parse(s.getItem(CHAVE_ANTIGA) ?? "null");
    if (Array.isArray(antiga)) {
      const mensagens = antiga.filter(ehMensagem);
      if (mensagens.length) {
        lista.push({
          id: novoId(),
          titulo: tituloDe(mensagens),
          atualizadaEm: Date.now(),
          mensagens,
        });
      }
      s.removeItem(CHAVE_ANTIGA);
      gravar(lista);
    }
  } catch {
    // Formato antigo ilegível: seguir sem ele é melhor que travar a tela.
  }

  return lista.sort((a, b) => b.atualizadaEm - a.atualizadaEm);
}

function gravar(lista: Conversa[]): void {
  const s = storage();
  if (!s) return;
  try {
    const podadas = lista
      .slice()
      .sort((a, b) => b.atualizadaEm - a.atualizadaEm)
      .slice(0, MAX_CONVERSAS);
    s.setItem(CHAVE, JSON.stringify(podadas));
  } catch {
    // Cota estourada: perder o histórico é melhor que derrubar a conversa
    // em andamento.
  }
}

/** Grava a conversa, criando-a se ainda não existir. Conversa sem mensagem
 *  nenhuma não é guardada — senão abrir o app criaria lixo a cada vez. */
export function salvarConversa(id: string, mensagens: Mensagem[]): void {
  const lista = listarConversas();
  const util = mensagens.slice(-MAX_MENSAGENS);
  const existente = lista.findIndex((c) => c.id === id);

  if (!util.length) {
    if (existente >= 0) lista.splice(existente, 1);
    gravar(lista);
    return;
  }

  // Duas gravações no mesmo milissegundo empatariam em `Date.now()` e a
  // ordem da lista viraria arbitrária — quem salvou por último tem que vir
  // primeiro, sempre. Daí o carimbo ser estritamente crescente.
  const maior = lista.reduce((m, c) => Math.max(m, c.atualizadaEm), 0);
  const conversa: Conversa = {
    id,
    titulo: tituloDe(util),
    atualizadaEm: Math.max(Date.now(), maior + 1),
    mensagens: util,
  };

  if (existente >= 0) lista[existente] = conversa;
  else lista.push(conversa);

  gravar(lista);
}

export function carregarConversa(id: string): Mensagem[] {
  return listarConversas().find((c) => c.id === id)?.mensagens ?? [];
}

export function apagarConversa(id: string): void {
  gravar(listarConversas().filter((c) => c.id !== id));
}

export function idAtual(): string | null {
  return storage()?.getItem(CHAVE_ATUAL) ?? null;
}

export function definirAtual(id: string): void {
  try {
    storage()?.setItem(CHAVE_ATUAL, id);
  } catch {
    // idem: seguir em memória.
  }
}
