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
  newUserId,
  openOrGetActiveDraft,
} from "@capsule/core";
import { slackClient } from "./slack";

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

/**
 * Fetch one Slack message and persist it into the user's active draft capsule.
 *
 * This is the function the shortcut handler calls via waitUntil(). It must be
 * idempotent — selecting the same message twice should not duplicate it. The
 * core layer already enforces that via the unique (capsule, channel, ts) idx.
 */
export async function ingestMessage(input: {
  teamId: string;
  slackUserId: string;
  channel: string;
  ts: string;
}): Promise<{ capsuleId: string } | { error: string }> {
  const ws = await getWorkspaceByTeam(input.teamId);
  if (!ws) return { error: "workspace_not_installed" };

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
    return { error: `slack_fetch_failed:${code}` };
  }

  if (!message) {
    return { error: "message_not_visible" };
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
      // Author resolution is best-effort. We'd rather have the message than fail the ingest.
    }
  }

  const { userId } = await upsertUser({
    slackUserId: input.slackUserId,
    workspaceId: ws.id,
  });

  const db = getDatabase();
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

  return { capsuleId: draft.id };
}
