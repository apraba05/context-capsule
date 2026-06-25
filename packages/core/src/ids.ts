import { customAlphabet } from "nanoid";

// URL-safe, lowercase. 21 chars ≈ 125 bits — plenty for unguessable capsule references.
const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export const newCapsuleId = customAlphabet(alphabet, 21);
export const newMessageId = customAlphabet(alphabet, 16);
export const newAuditId = customAlphabet(alphabet, 16);
export const newWorkspaceId = customAlphabet(alphabet, 16);
export const newUserId = customAlphabet(alphabet, 16);

/**
 * Slack permalink → (channel_id, ts). §8 of the spec describes the rule:
 * "insert decimal six from the end".
 *   https://acme.slack.com/archives/C01ABCD2EFG/p1718900000123456
 *     → { channel: "C01ABCD2EFG", ts: "1718900000.123456" }
 */
export function parseSlackPermalink(url: string): { channel: string; ts: string } | null {
  try {
    const u = new URL(url);
    if (!/\.slack\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/archives\/([A-Z0-9]+)\/p(\d{10,})/);
    if (!m) return null;
    const channel = m[1]!;
    const raw = m[2]!;
    if (raw.length < 7) return null;
    const ts = `${raw.slice(0, raw.length - 6)}.${raw.slice(-6)}`;
    return { channel, ts };
  } catch {
    return null;
  }
}
