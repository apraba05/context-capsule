import { eq } from "drizzle-orm";
import {
  decrypt,
  getDatabase,
  users,
  workspaces,
  type Workspace,
} from "@capsule/db";
import {
  addMessageToDraft,
  channelPolicyMessage,
  isChannelAllowed,
  newUserId,
  openOrGetActiveDraft,
  RateLimitError,
} from "@capsule/core";
import { postSlackFollowUp, slackClient } from "./slack";

/**
 * Resolve (or upsert) a Capsule user for the given Slack identity.
 */
export async function upsertUser(input: {
  slackUserId: string;
  workspaceId: string;
}): Promise<{ userId: string }> {
  const db = getDatabase();
  const existing = await db.query.users.findFirst({
    where: (u, { and, eq }) =>
      and(eq(u.workspaceId, input.workspaceId), eq(u.slackUserId, input.slackUserId)),
  });
  if (existing) return { userId: existing.id };

  const id = newUserId();
  const [created] = await db
    .insert(users)
    .values({
      id,
      slackUserId: input.slackUserId,
      workspaceId: input.workspaceId,
    })
    .returning();
  return { userId: created!.id };
}

export async function getWorkspaceByTeam(teamId: string): Promise<Workspace | null> {
  const db = getDatabase();
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.slackTeamId, teamId),
  });
  return ws ?? null;
}

export type IngestOutcome =
  | { ok: true; capsuleId: string }
  | { ok: false; kind: "workspace_not_installed" }
  | { ok: false; kind: "channel_policy"; message: string }
  | { ok: false; kind: "rate_limited"; message: string }
  | { ok: false; kind: "message_not_visible" }
  | { ok: false; kind: "slack_error"; code: string };

/**
 * Fetch one Slack message and persist it into the user's active draft capsule.
 *
 * This is the function the shortcut handler calls via after(). It must be
 * idempotent — selecting the same message twice should not duplicate it. The
 * core layer already enforces that via the unique (capsule, channel, ts) idx.
 *
 * If `responseUrl` is provided, this function will post a follow-up to Slack
 * (replacing the optimistic "added to capsule" ack) describing the real
 * outcome.
 */
export async function ingestMessage(input: {
  teamId: string;
  slackUserId: string;
  channel: string;
  ts: string;
  responseUrl?: string;
  webBaseUrl?: string;
}): Promise<IngestOutcome> {
  const outcome = await doIngest(input);
  if (input.responseUrl) {
    await postFollowUp(outcome, input.responseUrl, input.webBaseUrl);
  }
  return outcome;
}

async function doIngest(input: {
  teamId: string;
  slackUserId: string;
  channel: string;
  ts: string;
}): Promise<IngestOutcome> {
  const ws = await getWorkspaceByTeam(input.teamId);
  if (!ws) return { ok: false, kind: "workspace_not_installed" };

  // Workspace channel policy is the first gate. Refuse blocked channels
  // *before* contacting Slack — saves rate-limit budget AND ensures we never
  // see the message text we're refusing to ingest.
  const decision = isChannelAllowed(ws.channelPolicy, input.channel);
  if (!decision.allowed) {
    return {
      ok: false,
      kind: "channel_policy",
      message: channelPolicyMessage(decision.reason),
    };
  }

  const token = decrypt(ws.encryptedOauthToken);
  const client = slackClient(token);

  let message: { text?: string; user?: string; thread_ts?: string } | null = null;
  try {
    const res = await client.conversations.history({
      channel: input.channel,
      latest: input.ts,
      inclusive: true,
      limit: 1,
    });
    const raw = res.messages?.[0];
    message = raw
      ? {
          text: typeof raw.text === "string" ? raw.text : undefined,
          user: typeof raw.user === "string" ? raw.user : undefined,
          thread_ts: typeof raw.thread_ts === "string" ? raw.thread_ts : undefined,
        }
      : null;
  } catch (e) {
    const code = (e as { data?: { error?: string } }).data?.error ?? "slack_error";
    return { ok: false, kind: "slack_error", code };
  }

  if (!message) {
    return { ok: false, kind: "message_not_visible" };
  }

  let displayName = message.user ?? "unknown";
  let realName: string | undefined;
  if (message.user) {
    try {
      const info = await client.users.info({ user: message.user });
      displayName =
        info.user?.profile?.display_name?.trim() ||
        info.user?.profile?.real_name ||
        info.user?.name ||
        message.user;
      realName = info.user?.profile?.real_name;
    } catch {
      // Author resolution is best-effort.
    }
  }

  const { userId } = await upsertUser({
    slackUserId: input.slackUserId,
    workspaceId: ws.id,
  });

  const db = getDatabase();
  try {
    const draft = await openOrGetActiveDraft(db, {
      ownerId: userId,
      workspaceId: ws.id,
    });

    await addMessageToDraft(db, {
      capsuleId: draft.id,
      slackChannelId: input.channel,
      slackTs: input.ts,
      threadTs: message.thread_ts ?? null,
      text: message.text ?? "",
      author: {
        slackUserId: message.user ?? "unknown",
        displayName,
        realName,
      },
    });

    return { ok: true, capsuleId: draft.id };
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { ok: false, kind: "rate_limited", message: e.message };
    }
    throw e;
  }
}

async function postFollowUp(
  outcome: IngestOutcome,
  responseUrl: string,
  webBaseUrl?: string,
): Promise<void> {
  const base = webBaseUrl ?? process.env.PUBLIC_BASE_URL ?? process.env.WEB_BASE_URL;

  if (outcome.ok) {
    const capsuleUrl = base ? `${base}/capsules/${outcome.capsuleId}` : null;
    await postSlackFollowUp(responseUrl, {
      text: `:capsule: Added to your draft capsule.${
        capsuleUrl ? ` Review and seal: ${capsuleUrl}` : ""
      }`,
    });
    return;
  }

  const text = (() => {
    switch (outcome.kind) {
      case "workspace_not_installed":
        return ":warning: Context Capsule isn't installed in this workspace.";
      case "channel_policy":
        return `:no_entry_sign: ${outcome.message}`;
      case "rate_limited":
        return `:hourglass: ${outcome.message}`;
      case "message_not_visible":
        return ":warning: I can't see that message. Invite the Context Capsule bot to this channel and try again.";
      case "slack_error":
        return `:warning: Slack returned an error (${outcome.code}). Try again, or check that the bot has been invited to this channel.`;
    }
  })();

  await postSlackFollowUp(responseUrl, { text });
}
