import type { ClientProject, GitStatus, HostingStatus, BillingInfo } from "@/types/project";

export type Tone = "ok" | "warn" | "danger" | "neutral";

export function gitTone(git: GitStatus): Tone {
  if (git.error) return "neutral";
  if (git.dirty_files > 8 || git.unpushed_commits > 3) return "warn";
  if (git.dirty_files > 0 || git.unpushed_commits > 0) return "warn";
  return "ok";
}

export function hostingTone(hosting: HostingStatus | null): Tone {
  if (!hosting) return "neutral";
  if (hosting.health === "down") return "danger";
  if (hosting.health === "unknown") return "warn";
  return "ok";
}

export function billingTone(billing: BillingInfo | null): Tone {
  if (!billing) return "neutral";
  if (billing.status === "vencida") return "danger";
  if (billing.status === "vencendo") return "warn";
  if (billing.status === "desconhecido") return "neutral";
  return "ok";
}

/**
 * The single dot in the card header: worst tone among the three rows.
 * danger > warn > ok > neutral, so one late invoice or a down site is
 * never hidden behind two otherwise-fine rows.
 */
export function overallTone(project: ClientProject): Tone {
  const tones = [
    gitTone(project.git),
    hostingTone(project.hosting),
    billingTone(project.billing),
  ];
  if (tones.includes("danger")) return "danger";
  if (tones.includes("warn")) return "warn";
  if (tones.every((t) => t === "neutral")) return "neutral";
  return "ok";
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d atrás`;
}
