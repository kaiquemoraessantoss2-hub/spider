import type { ClientProject } from "@/types/project";

/**
 * True when running inside the Tauri webview. False in a plain browser
 * (`npm run dev` opened at localhost) — lets us preview and iterate on the
 * UI without a working Rust build.
 */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const MOCK_PROJECTS: ClientProject[] = [
  {
    id: "wcj-instalacoes",
    display_name: "WCJ Instalações Hidráulicas e Elétricas",
    path: "~/projetos/wcj-instalacoes",
    brand: "koder",
    git: {
      branch: "main",
      dirty_files: 3,
      unpushed_commits: 1,
      last_commit_at: "2026-08-22T14:10:00-03:00",
      last_commit_message: "ajusta validação de requisição de material",
      error: null,
    },
    hosting: { health: "up", http_status: 200, checked_at: "2026-08-23T09:00:00-03:00" },
    billing: { status: "em_dia", next_due_at: "2026-09-05T00:00:00-03:00", amount_cents: null },
  },
  {
    id: "neon-cosmeticos",
    display_name: "Neon Cosméticos",
    path: "~/projetos/neon-cosmeticos",
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
  },
  {
    id: "sorris-odonto",
    display_name: "Sorris Odonto",
    path: "~/projetos/sorris-odonto",
    brand: "smid",
    git: {
      branch: "feature/agenda-recorrente",
      dirty_files: 12,
      unpushed_commits: 4,
      last_commit_at: "2026-08-23T18:40:00-03:00",
      last_commit_message: "wip: regras de recorrência semanal",
      error: null,
    },
    hosting: null,
    billing: null,
  },
];

export async function fetchProjects(): Promise<ClientProject[]> {
  if (!inTauri()) {
    // Simulate latency so loading states are visible during UI dev.
    await new Promise((r) => setTimeout(r, 250));
    return MOCK_PROJECTS;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ClientProject[]>("list_projects");
}

/**
 * Hands a project off to Orca instead of reimplementing PTY/worktree
 * handling. Shells out to `orca worktree create` (see
 * src-tauri/src/commands/orca.rs) — the CLI is the mature surface today;
 * the formal Run/Task/Dispatch orchestration layer is still marked
 * Experimental upstream, so we don't depend on it yet.
 */
export async function openInOrca(project: ClientProject): Promise<void> {
  if (!inTauri()) {
    console.info(`[mock] abriria "${project.display_name}" no Orca`);
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("open_in_orca", { projectId: project.id, path: project.path });
}
