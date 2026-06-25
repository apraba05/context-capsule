/**
 * The capsule glyph. A pill/lozenge — the geometry of a "context capsule."
 * Used as the brand mark and as the seal stamp when a capsule finalizes.
 */
export function CapsuleMark({
  size = 24,
  tone = "ink",
  className,
}: {
  size?: number;
  tone?: "ink" | "accent" | "sealed";
  className?: string;
}) {
  const stroke =
    tone === "accent" ? "var(--accent)" : tone === "sealed" ? "var(--sealed)" : "var(--ink)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="3"
        y="7"
        width="18"
        height="10"
        rx="5"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <path d="M12 7v10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Lock motif used in the seal stamp. */
export function SealLock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        fill="var(--sealed)"
      />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        stroke="var(--sealed)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
