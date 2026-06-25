export type RedactionReason = "api_key" | "email" | "pii" | "denylist" | "manual";

export type RedactedSpan = {
  /** Inclusive char offset into the original message text. */
  start: number;
  /** Exclusive char offset. */
  end: number;
  reason: RedactionReason;
  /** Optional pattern identifier (e.g. "anthropic_key"). */
  detector?: string;
};

export type Detector = {
  id: string;
  reason: RedactionReason;
  /** Returns all non-overlapping matches in the input. */
  scan(input: string): { start: number; end: number }[];
};
