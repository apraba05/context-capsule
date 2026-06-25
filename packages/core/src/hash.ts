import { createHash } from "node:crypto";
import type { CapsuleMessage } from "@capsule/db";

/**
 * Canonical content hash for a finalized capsule.
 *
 * Hashes a deterministic, ordered JSON projection of the included messages
 * (in thread + ts order) using their *redacted* text_snapshot. The hash is the
 * "wax seal" surfaced in the UI — proof the capsule has not been tampered with
 * after sealing.
 */
export function computeContentHash(messages: CapsuleMessage[]): string {
  const ordered = [...messages]
    .filter((m) => m.included)
    .sort((a, b) => {
      if (a.slackChannelId !== b.slackChannelId) {
        return a.slackChannelId.localeCompare(b.slackChannelId);
      }
      if (a.threadTs && b.threadTs && a.threadTs === b.threadTs) {
        return a.threadPosition - b.threadPosition;
      }
      return a.slackTs.localeCompare(b.slackTs);
    })
    .map((m) => ({
      channel: m.slackChannelId,
      ts: m.slackTs,
      author: m.authorResolved?.slackUserId ?? null,
      text: m.textSnapshot,
    }));

  const hash = createHash("sha256");
  hash.update(JSON.stringify(ordered));
  return hash.digest("hex");
}

/** Short, eye-grabbing form for the seal UI (first 12 hex chars). */
export function shortHash(full: string): string {
  return full.slice(0, 12);
}
