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
