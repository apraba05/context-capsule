import type { ChannelPolicy } from "@capsule/db";

export type ChannelDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * Pure policy evaluation. Given a workspace's channel policy and a Slack
 * channel id, decide whether the channel is allowed to contribute messages to
 * a capsule.
 *
 * Enforced at ingest time (before any Slack API call), not at dereference.
 * Once a message is inside a capsule, the capsule is immutable; changing the
 * policy later does not retroactively delete already-ingested messages — it
 * just stops new ones from coming in.
 */
export function isChannelAllowed(
  policy: ChannelPolicy | null | undefined,
  channelId: string,
): ChannelDecision {
  if (!policy || policy.mode === "none") {
    return { allowed: true };
  }
  const set = new Set(policy.channels);
  if (policy.mode === "blocklist") {
    return set.has(channelId)
      ? { allowed: false, reason: "channel_blocked_by_workspace_policy" }
      : { allowed: true };
  }
  // allowlist
  return set.has(channelId)
    ? { allowed: true }
    : { allowed: false, reason: "channel_not_in_workspace_allowlist" };
}

export function channelPolicyMessage(reason: string): string {
  switch (reason) {
    case "channel_blocked_by_workspace_policy":
      return "This channel is on your workspace's blocked list. Add it via Settings → Channel access if this was intentional.";
    case "channel_not_in_workspace_allowlist":
      return "Your workspace is configured to only allow specific channels. This channel is not on that list.";
    default:
      return "Channel access denied by workspace policy.";
  }
}
