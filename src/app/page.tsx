"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@/lib/tauri";
import { ProjectCard } from "@/components/ProjectCard";
import { overallTone } from "@/lib/status";

export default function Home() {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    refetchInterval: 5 * 60 * 1000, // git/hosting state is cheap to re-poll
  });

  const attentionCount =
    projects?.filter((p) => overallTone(p) !== "ok" && overallTone(p) !== "neutral")
      .length ?? 0;

  return (
    <main className="min-h-screen px-6 py-5">
      <header className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-red">
            Spider
          </h1>
          <span className="font-mono text-[11px] text-ink-faint">
            painel de status
          </span>
        </div>
        <div className="font-mono text-[11px] text-ink-muted">
          {isLoading
            ? "sincronizando…"
            : `${projects?.length ?? 0} projeto(s) · ${attentionCount} pedindo atenção`}
        </div>
      </header>

      {error && (
        <p className="font-mono text-xs text-danger">
          falha ao carregar projetos: {String(error)}
        </p>
      )}

      {isLoading ? (
        <p className="font-mono text-xs text-ink-faint">carregando…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}
