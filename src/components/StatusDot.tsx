type Tone = "ok" | "warn" | "danger" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  neutral: "bg-ink-faint",
};

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-1.5 w-1.5 rounded-full ${TONE_COLOR[tone]}`}
        aria-hidden
      />
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </span>
    </span>
  );
}
