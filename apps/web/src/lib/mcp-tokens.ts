import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Phase 1: bearer-token MCP auth.
 *
 * Token format: cap_mcp_<base64url(rand-32)>
 * Stored in users.mcpSubject as `mcp:<sha256(token)>`. We only ever store the
 * hash, so a database read can't recover the token.
 *
 * Phase 2 should replace this with OAuth (Authorization Server Metadata,
 * Dynamic Client Registration) per the MCP authorization spec.
 */

const TOKEN_PREFIX = "cap_mcp_";
const SUBJECT_PREFIX = "mcp:";

export function mintToken(): { token: string; subject: string } {
  const raw = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${raw}`;
  const subject = `${SUBJECT_PREFIX}${sha256Hex(token)}`;
  return { token, subject };
}

export function subjectForToken(token: string): string {
  return `${SUBJECT_PREFIX}${sha256Hex(token)}`;
}

export function isCapsuleMcpToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

export function constantTimeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
