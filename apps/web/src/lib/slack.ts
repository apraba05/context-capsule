import { createHmac, timingSafeEqual } from "node:crypto";
import { WebClient } from "@slack/web-api";

/**
 * Verify a Slack request signature per
 * https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * Replay window: 5 minutes.
 */
export function verifySlackSignature(opts: {
  signingSecret: string;
  signature: string | null;
  timestamp: string | null;
  body: string;
}): boolean {
  const { signingSecret, signature, timestamp, body } = opts;
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const base = `v0:${timestamp}:${body}`;
  const expected = "v0=" + createHmac("sha256", signingSecret).update(base).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function slackClient(accessToken: string): WebClient {
  return new WebClient(accessToken);
}
