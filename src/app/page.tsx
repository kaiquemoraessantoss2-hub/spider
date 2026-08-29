"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@/lib/tauri";
import { ProjectCard } from "@/components/ProjectCard";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { overallTone } from "@/lib/status";

export default function Home() {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    refetchInterval: 5 * 60 * 1000,
  });

  const attentionCount =
    projects?.filter((p) => overallTone(p) !== "ok" && overallTone(p) !== "neutral").length ?? 0;

  return (
    <main className="hud-vignette flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-sm font-semibold tracking-[0.42em] text-ink">
            SPIDER
          </span>
          <MicroLabel tone="ember">inteligência operacional</MicroLabel>
        </div>
        <MicroLabel>
          {isLoading
            ? "sincronizando"
            : `${projects?.length ?? 0} projetos · ${attentionCount} pedindo atenção`}
        </MicroLabel>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-line min-[1100px]:grid-cols-[360px_1fr_380px]">
        <aside className="overflow-y-auto bg-void-deep p-4">
          <div className="mb-3">
            <MicroLabel tone="faint">projetos</MicroLabel>
          </div>
          {error && (
            <p className="font-display text-xs text-danger">
              falha ao carregar: {String(error)}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {projects?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </aside>

        {/* O core some abaixo de 1100px: em janela estreita ele roubaria o
            espaço de quem manda, que é o dado. */}
        <section className="hidden items-center justify-center bg-void-deep min-[1100px]:flex">
          {/* Placeholder até a Tarefa 9 criar o componente real. */}
          <MicroLabel tone="faint">core de voz</MicroLabel>
        </section>

        <aside className="flex flex-col overflow-hidden bg-void-deep">
          {/* Placeholder até a Tarefa 8 criar o componente real. */}
          <MicroLabel tone="faint">conversa</MicroLabel>
        </aside>
      </div>
    </main>
  );
}
