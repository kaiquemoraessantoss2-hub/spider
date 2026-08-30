"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@/lib/tauri";
import { ProjectCard } from "@/components/ProjectCard";
import { ChatPanel } from "@/components/ChatPanel";
import { MicroLabel } from "@/components/hud/MicroLabel";
import { ParticleField } from "@/components/hud/ParticleField";
import { VoiceCore } from "@/components/VoiceCore";
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
    <main className="relative z-10 flex min-h-screen flex-col">
      <ParticleField />
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-sm font-semibold tracking-[0.42em] text-ink">
            SPIDER
          </span>
          <MicroLabel tone="ember">inteligência operacional</MicroLabel>
        </div>

        {/* Abaixo de 1100px o core central some (ver seção mais abaixo) —
            aqui ele reaparece pequeno, sem roubar o espaço do dado. Mesmo
            componente, prop de tamanho: nunca os dois ativos ao mesmo tempo. */}
        <div className="flex min-[1100px]:hidden">
          <VoiceCore size={40} />
        </div>

        <MicroLabel>
          {isLoading
            ? "sincronizando"
            : `${projects?.length ?? 0} projetos · ${attentionCount} pedindo atenção`}
        </MicroLabel>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-line/60 min-[1100px]:grid-cols-[360px_1fr_380px]">
        <aside className="overflow-y-auto bg-void-deep/70 p-4 backdrop-blur-[1px]">
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
        <section className="hidden items-center justify-center min-[1100px]:flex">
          <VoiceCore />
        </section>

        <aside className="flex flex-col overflow-hidden bg-void-deep/70 backdrop-blur-[1px]">
          <ChatPanel projects={projects ?? []} />
        </aside>
      </div>
    </main>
  );
}
