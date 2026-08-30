"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, listarModelosGratuitos } from "@/lib/llm";
import { ASR_PROVIDERS, OPENROUTER_ASR_MODELS } from "@/lib/voice";
import { testarTudo, type Diagnostico } from "@/lib/diagnostics";
import { escolherPastaDeProjetos } from "@/lib/tauri";
import {
  loadSettings,
  saveSettings,
  type AsrProviderId,
  type ProviderId,
  type Settings,
} from "@/lib/settings";
import { MicroLabel } from "@/components/hud/MicroLabel";

/**
 * `onClose` recebe as Settings novas só quando o usuário salva. Cancelar
 * (Esc, clique fora, botão cancelar) chama onClose() sem argumento — não
 * pode propagar alteração nenhuma no que já estava salvo.
 */
export function SettingsDialog({ onClose }: { onClose: (s?: Settings) => void }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[] | null>(null);
  const [gratuitos, setGratuitos] = useState<string[]>([]);
  const [testando, setTestando] = useState(false);

  // Busca o catálogo vivo em vez de confiar na lista embutida: modelo
  // gratuito é removido do OpenRouter sem aviso, e um id morto vira 404.
  useEffect(() => {
    if (settings.provider !== "openrouter") return;
    let ativo = true;
    void listarModelosGratuitos().then((ids) => {
      if (ativo) setGratuitos(ids);
    });
    return () => {
      ativo = false;
    };
  }, [settings.provider]);

  async function testar() {
    setTestando(true);
    setDiagnosticos(null);
    try {
      // Testa com o que está na tela, não com o que está salvo — assim dá
      // pra validar uma key nova antes de gravá-la.
      setDiagnosticos(await testarTudo(settings));
    } finally {
      setTestando(false);
    }
  }
  const provider = PROVIDERS[settings.provider];

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-void-deep/90 p-4"
      onClick={(e) => {
        // Só fecha se o clique foi no backdrop, não em algo dentro do painel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="configuração" className="hud-frame w-full max-w-sm p-4">
        <div className="mb-4">
          <MicroLabel tone="ember">configuração</MicroLabel>
        </div>

        <label className="mb-3 block">
          <MicroLabel>provedor</MicroLabel>
          <select
            value={settings.provider}
            onChange={(e) => {
              const id = e.target.value as ProviderId;
              setSettings({ ...settings, provider: id, model: PROVIDERS[id].models[0] ?? "" });
            }}
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 text-sm text-ink"
          >
            {Object.entries(PROVIDERS).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <MicroLabel>
            modelo
            {settings.provider === "openrouter" && gratuitos.length
              ? ` · ${gratuitos.length} gratuitos no catálogo`
              : ""}
          </MicroLabel>
          <select
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
          >
            {/* O modelo salvo entra na lista mesmo se não estiver no catálogo,
                senão o select trocaria a escolha do usuário sozinho. */}
            {Array.from(
              new Set([
                settings.model,
                ...(settings.provider === "openrouter" && gratuitos.length
                  ? gratuitos
                  : provider.models),
              ]),
            ).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 block">
          <MicroLabel>key de {provider.label}</MicroLabel>
          <input
            type="password"
            value={settings.keys[settings.provider]}
            onChange={(e) =>
              setSettings({
                ...settings,
                keys: { ...settings.keys, [settings.provider]: e.target.value },
              })
            }
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
            placeholder="sk-..."
          />
          <span className="mt-1 block text-[10px] text-ink-faint">
            guardada em texto puro no perfil desta máquina
          </span>
        </label>

        <div className="mb-4 block">
          <MicroLabel>pasta dos projetos</MicroLabel>
          <button
            type="button"
            onClick={async () => {
              const pasta = await escolherPastaDeProjetos();
              if (pasta) setSettings({ ...settings, projectsRoot: pasta });
            }}
            className="mt-1 w-full truncate border border-line bg-panel px-2 py-1.5 text-left font-mono text-xs text-ink hover:border-red"
            title={settings.projectsRoot || undefined}
          >
            {settings.projectsRoot || "escolher pasta…"}
          </button>
          <span className="mt-1 block text-[10px] text-ink-faint">
            uma subpasta por cliente — o seletor nativo só abre dentro do app
          </span>
        </div>

        <label className="mb-3 block">
          <MicroLabel>quem transcreve a fala</MicroLabel>
          <select
            value={settings.asrProvider}
            onChange={(e) =>
              setSettings({ ...settings, asrProvider: e.target.value as AsrProviderId })
            }
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 text-sm text-ink"
          >
            {Object.entries(ASR_PROVIDERS).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-ink-faint">
            {ASR_PROVIDERS[settings.asrProvider].ajuda}
          </span>
        </label>

        {settings.asrProvider === "openrouter" && (
          <label className="mb-3 block">
            <MicroLabel>modelo de transcrição</MicroLabel>
            <input
              type="text"
              list="modelos-de-transcricao"
              value={settings.asrModel}
              onChange={(e) => setSettings({ ...settings, asrModel: e.target.value })}
              className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
              placeholder="openai/whisper-large-v3-turbo"
            />
            <datalist id="modelos-de-transcricao">
              {OPENROUTER_ASR_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className="mt-1 block text-[10px] text-ink-faint">
              precisa de crédito na conta — não há modelo de transcrição gratuito
            </span>
          </label>
        )}

        <label className="mb-4 block">
          <MicroLabel>key de {ASR_PROVIDERS[settings.asrProvider].label} (voz)</MicroLabel>
          <input
            type="password"
            value={settings.asrKeys[settings.asrProvider]}
            onChange={(e) =>
              setSettings({
                ...settings,
                asrKeys: { ...settings.asrKeys, [settings.asrProvider]: e.target.value },
              })
            }
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
            placeholder={settings.asrProvider === "elevenlabs" ? "sk_..." : "sk-or-..."}
          />
          <span className="mt-1 block text-[10px] text-ink-faint">
            usada só para transcrever sua fala
          </span>
        </label>

        <div className="mb-4 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => void testar()}
            disabled={testando}
            className="w-full border border-line px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-ink-muted hover:border-red hover:text-red disabled:opacity-50"
          >
            {testando ? "testando…" : "testar conexões"}
          </button>

          {diagnosticos?.map((d) => (
            <div key={d.alvo} className="mt-2">
              <div className="flex items-baseline gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.ok ? "bg-ok" : "bg-danger"}`}
                  aria-hidden
                />
                <MicroLabel>{d.alvo}</MicroLabel>
              </div>
              <p className="ml-3.5 break-all font-mono text-[10px] leading-snug text-ink-muted">
                {d.detalhe}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onClose()}
            className="flex-1 border border-line px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-ink-muted hover:border-ink-muted"
          >
            cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              saveSettings(settings);
              onClose(settings);
            }}
            className="flex-1 border border-red px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-red hover:bg-red hover:text-void-deep"
          >
            salvar
          </button>
        </div>
      </div>
    </div>
  );
}
