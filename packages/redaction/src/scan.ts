import { DEFAULT_DETECTORS, denylistDetector } from "./detectors";
import type { Detector, RedactedSpan } from "./types";

export type ScanOptions = {
  detectors?: Detector[];
  /** Literal strings the user wants always removed. */
  denylist?: string[];
};

/**
 * Scan input text for secrets/PII. Returns merged, non-overlapping spans
 * sorted by start position. Overlapping detections are union-merged and the
 * highest-severity reason wins (api_key > pii > denylist > email).
 */
export function scanForSecrets(input: string, opts: ScanOptions = {}): RedactedSpan[] {
  const detectors = [
    ...(opts.detectors ?? DEFAULT_DETECTORS),
    ...(opts.denylist ?? []).map(denylistDetector),
  ];

  const raw: RedactedSpan[] = [];
  for (const d of detectors) {
    for (const m of d.scan(input)) {
      raw.push({ start: m.start, end: m.end, reason: d.reason, detector: d.id });
    }
  }
  return mergeSpans(raw);
}

const SEVERITY: Record<RedactedSpan["reason"], number> = {
  api_key: 4,
  pii: 3,
  denylist: 2,
  manual: 2,
  email: 1,
};

export function mergeSpans(spans: RedactedSpan[]): RedactedSpan[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: RedactedSpan[] = [];
  let cur = { ...sorted[0]! };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]!;
    if (s.start <= cur.end) {
      cur.end = Math.max(cur.end, s.end);
      if (SEVERITY[s.reason] > SEVERITY[cur.reason]) {
        cur.reason = s.reason;
        cur.detector = s.detector;
      }
    } else {
      out.push(cur);
      cur = { ...s };
    }
  }
  out.push(cur);
  return out;
}

/**
 * Apply spans destructively to the text. Once applied, the original chars
 * are gone — by design.
 *
 * Replacement is `[redacted:<reason>]`. Short enough to read in context,
 * tagged enough for the agent to know "something was here."
 */
export function applyRedactions(text: string, spans: RedactedSpan[]): string {
  if (spans.length === 0) return text;
  const merged = mergeSpans(spans);
  let out = "";
  let cursor = 0;
  for (const s of merged) {
    if (s.start > cursor) out += text.slice(cursor, s.start);
    out += `[redacted:${s.reason}]`;
    cursor = s.end;
  }
  if (cursor < text.length) out += text.slice(cursor);
  return out;
}
