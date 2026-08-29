"use client";

import { useState } from "react";
import { PROVIDERS } from "@/lib/llm";
import { loadSettings, saveSettings, type ProviderId, type Settings } from "@/lib/settings";
import { MicroLabel } from "@/components/hud/MicroLabel";

export function SettingsDialog({ onClose }: { onClose: (s: Settings) => void }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const provider = PROVIDERS[settings.provider];

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-void-deep/90 p-4">
      <div className="hud-frame w-full max-w-sm p-4">
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
          <MicroLabel>modelo</MicroLabel>
          <select
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
          >
            {provider.models.map((m) => (
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

        <label className="mb-4 block">
          <MicroLabel>key do Groq (voz)</MicroLabel>
          <input
            type="password"
            value={settings.groqKey}
            onChange={(e) => setSettings({ ...settings, groqKey: e.target.value })}
            className="mt-1 w-full border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink"
            placeholder="gsk_..."
          />
          <span className="mt-1 block text-[10px] text-ink-faint">
            usada só para transcrever sua fala
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            saveSettings(settings);
            onClose(settings);
          }}
          className="w-full border border-red px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-red hover:bg-red hover:text-void-deep"
        >
          salvar
        </button>
      </div>
    </div>
  );
}
