"use client";

import type { ClientProject } from "@/types/project";
import {
  overallTone,
  gitTone,
  hostingTone,
  billingTone,
  formatRelativeTime,
} from "@/lib/status";
import { StatusDot } from "@/components/StatusDot";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { openInOrca } from "@/lib/tauri";

const BRAND_LABEL: Record<NonNullable<ClientProject["brand"]>, string> = {
  smid: "SMiD",
  koder: "Koder",
};

const BILLING_LABEL: Record<string, string> = {
  em_dia: "em dia",
  vencendo: "vencendo",
  vencida: "vencida",
  desconhecido: "—",
};

export function ProjectCard({ project }: { project: ClientProject }) {
  const tone = overallTone(project);

  return (
    <article className="hud-frame flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                tone === "danger"
                  ? "bg-danger"
                  : tone === "warn"
                    ? "bg-warn"
                    : tone === "ok"
                      ? "bg-ok"
                      : "bg-ink-faint"
              }`}
              aria-hidden
            />
            <h2 className="font-display text-[15px] font-medium tracking-wide text-ink">
              {project.display_name}
            </h2>
          </div>
          {project.brand && (
            <span className="mt-1 inline-block font-display text-[10px] uppercase tracking-wider text-ink-faint">
              {BRAND_LABEL[project.brand]}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => openInOrca(project)}
          className="shrink-0 border border-line px-2.5 py-1 font-display text-[10px] uppercase tracking-wider text-ink-muted transition-colors hover:border-red hover:text-red"
        >
          Abrir no Orca
        </button>
      </header>

      <div className="hud-scanline" />

      <dl className="flex flex-col gap-2">
        <Row label="git">
          <StatusDot tone={gitTone(project.git)} label={project.git.branch} />
          {project.git.error ? (
            // Mensagem de erro é prosa, não dado técnico — fica fora do mono.
            <span className="font-display text-xs text-ink-muted">{project.git.error}</span>
          ) : (
            // Contagem de arquivos sujos e commits não enviados: dado técnico, mono.
            <span className="font-mono text-xs text-ink-muted">
              {project.git.dirty_files} arquivo(s) · {project.git.unpushed_commits} não enviado(s)
            </span>
          )}
        </Row>

        <Row label="site">
          {project.hosting ? (
            <>
              <StatusDot
                tone={hostingTone(project.hosting)}
                label={project.hosting.health === "up" ? "no ar" : project.hosting.health === "down" ? "fora do ar" : "desconhecido"}
              />
              {/* Timestamp relativo: dado técnico, mono. */}
              <span className="font-mono text-xs text-ink-muted">
                {formatRelativeTime(project.hosting.checked_at)}
              </span>
            </>
          ) : (
            <span className="font-display text-xs text-ink-faint">não configurado</span>
          )}
        </Row>

        <Row label="cobrança">
          {project.billing ? (
            <>
              <StatusDot
                tone={billingTone(project.billing)}
                label={BILLING_LABEL[project.billing.status] ?? "—"}
              />
              <span className="font-display text-xs text-ink-muted">
                {project.billing.next_due_at
                  ? `vence ${new Date(project.billing.next_due_at).toLocaleDateString("pt-BR")}`
                  : "—"}
              </span>
            </>
          ) : (
            <span className="font-display text-xs text-ink-faint">não configurado</span>
          )}
        </Row>
      </dl>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="w-16 shrink-0">
        <MicroLabel tone="faint">{label}</MicroLabel>
      </dt>
      <dd className="flex flex-1 items-center justify-between gap-2">{children}</dd>
    </div>
  );
}
