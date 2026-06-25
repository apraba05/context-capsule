import type { Detector } from "./types";

function regexDetector(id: string, reason: Detector["reason"], pattern: RegExp): Detector {
  // Force global so we get every occurrence.
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  return {
    id,
    reason,
    scan(input) {
      const out: { start: number; end: number }[] = [];
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(input)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        out.push({ start: m.index, end: m.index + m[0].length });
      }
      return out;
    },
  };
}

/**
 * Provider-specific API-key patterns. These are deliberately tight to avoid
 * false positives on prose. Each one is rooted in a published prefix.
 */
export const PROVIDER_KEY_DETECTORS: Detector[] = [
  regexDetector("anthropic_key", "api_key", /sk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{32,}/g),
  regexDetector("openai_key", "api_key", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g),
  regexDetector("github_token", "api_key", /gh[pousr]_[A-Za-z0-9]{36,}/g),
  regexDetector("slack_token", "api_key", /xox[abprs]-[A-Za-z0-9-]{10,}/g),
  regexDetector("aws_access_key", "api_key", /AKIA[0-9A-Z]{16}/g),
  regexDetector("google_api_key", "api_key", /AIza[0-9A-Za-z_-]{35}/g),
  regexDetector("stripe_key", "api_key", /(?:sk|pk|rk)_(?:test|live)_[0-9A-Za-z]{16,}/g),
  regexDetector("private_key_block", "api_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g),
];

// Email — pragmatic, not RFC-perfect. Avoids matching trailing punctuation.
export const EMAIL_DETECTOR: Detector = regexDetector(
  "email",
  "email",
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
);

/**
 * Shannon entropy in bits per character. High-entropy strings (≥4.0) of
 * sufficient length tend to be credentials. We rate-limit this to tokens
 * already isolated by whitespace or quoting, to keep prose false-positives low.
 */
function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Spans like `Bearer eyJxx…` or `password=xxxxx` — high-entropy tokens. */
export const HIGH_ENTROPY_DETECTOR: Detector = {
  id: "high_entropy",
  reason: "api_key",
  scan(input) {
    const out: { start: number; end: number }[] = [];
    // Tokens of 24+ printable non-space, non-quote chars.
    const re = /[A-Za-z0-9_\-./+=]{24,}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const tok = m[0];
      // Skip obvious URLs and file paths to reduce noise.
      if (/^https?:\/\//i.test(tok)) continue;
      if (tok.includes("/") && !tok.includes(".") && tok.length < 40) continue;
      if (shannonEntropy(tok) >= 4.0) {
        out.push({ start: m.index, end: m.index + tok.length });
      }
    }
    return out;
  },
};

/** US SSN-ish (loose). Marked as PII so the UI can show a distinct color. */
export const SSN_DETECTOR: Detector = regexDetector("us_ssn", "pii", /\b\d{3}-\d{2}-\d{4}\b/g);

/** Credit-card-ish 13-19 digit runs with optional spaces/dashes. */
export const CREDIT_CARD_DETECTOR: Detector = {
  id: "credit_card",
  reason: "pii",
  scan(input) {
    const out: { start: number; end: number }[] = [];
    const re = /\b(?:\d[ -]*?){13,19}\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const digits = m[0].replace(/[^\d]/g, "");
      if (digits.length < 13 || digits.length > 19) continue;
      if (luhn(digits)) {
        out.push({ start: m.index, end: m.index + m[0].length });
      }
    }
    return out;
  },
};

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export const DEFAULT_DETECTORS: Detector[] = [
  ...PROVIDER_KEY_DETECTORS,
  EMAIL_DETECTOR,
  HIGH_ENTROPY_DETECTOR,
  SSN_DETECTOR,
  CREDIT_CARD_DETECTOR,
];

/** Build a detector from a user-supplied literal denylist entry. */
export function denylistDetector(needle: string): Detector {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return regexDetector(`denylist:${needle.slice(0, 24)}`, "denylist", new RegExp(escaped, "g"));
}
