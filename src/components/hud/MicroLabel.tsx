/**
 * A densidade técnica da referência vem daqui: label minúsculo, caixa alta,
 * tracking muito aberto. Em sans, não em mono — mono fica reservado a dado
 * técnico de verdade (branch, contagem, timestamp).
 */
export function MicroLabel({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "ember" | "faint";
}) {
  const color =
    tone === "ember" ? "text-ember" : tone === "faint" ? "text-ink-faint" : "text-ink-muted";

  return (
    <span
      className={`font-display text-[9px] font-medium uppercase tracking-[0.25em] ${color}`}
    >
      {children}
    </span>
  );
}
