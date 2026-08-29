/**
 * Mirrors the Rust struct `GitStatus` in src-tauri/src/commands/git.rs.
 * Keep both in sync manually — Tauri doesn't generate types for us.
 */
export interface GitStatus {
  branch: string;
  dirty_files: number;
  unpushed_commits: number;
  last_commit_at: string | null; // ISO 8601, null if repo has no commits yet
  last_commit_message: string | null;
  error: string | null; // set when the path isn't a git repo / git isn't found
}

export type SiteHealth = "up" | "down" | "unknown";

export interface HostingStatus {
  health: SiteHealth;
  http_status: number | null;
  checked_at: string | null;
}

export type BillingStatus = "em_dia" | "vencendo" | "vencida" | "desconhecido";

export interface BillingInfo {
  status: BillingStatus;
  next_due_at: string | null;
  amount_cents: number | null;
}

/**
 * One card on the dashboard. `git` is populated by the local collector on
 * every app launch; `hosting` and `billing` are optional because those
 * integrations (Coolify, Asaas) come in a later pass — the UI renders a
 * "não configurado" state until then.
 */
export interface ClientProject {
  id: string; // folder name, used as the React key and Orca worktree name
  display_name: string;
  path: string;
  brand: "smid" | "koder" | null;
  git: GitStatus;
  hosting: HostingStatus | null;
  billing: BillingInfo | null;
}
