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
