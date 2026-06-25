"use client";
import type { RedactedSpan } from "@capsule/db";

/**
 * Render text with detected secret spans highlighted in --alert coral.
 * Click handler lets the user remove (or restore) a specific span.
 */
export function RedactedText({
  text,
  spans,
  onToggle,
  finalized = false,
}: {
  text: string;
  spans: RedactedSpan[];
  onToggle?: (span: RedactedSpan, index: number) => void;
  finalized?: boolean;
}) {
  if (spans.length === 0) {
    return <span>{text}</span>;
  }

  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((s, i) => {
    if (s.start > cursor) {
      out.push(<span key={`p-${i}`}>{text.slice(cursor, s.start)}</span>);
    }
    const slice = text.slice(s.start, s.end);
    out.push(
      <button
        key={`s-${i}`}
        type="button"
        onClick={onToggle ? () => onToggle(s, i) : undefined}
        className="rounded px-1 align-baseline bg-alert-soft text-alert font-mono"
        title={finalized ? "Removed" : `Click to remove — ${s.reason}`}
        disabled={finalized || !onToggle}
      >
        {finalized ? `[redacted:${s.reason}]` : slice}
      </button>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) {
    out.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return <>{out}</>;
}
