import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { decrypt, getDatabase, workspaces } from "@capsule/db";
import { getSession } from "@/lib/session";
import { slackClient } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List channels the bot can see in the current user's workspace.
 *
 * Pulled on demand — no background sync. Pages through conversations.list,
 * collects up to 1000 channels (Slack's per-call cap × 1 page; reasonable
 * for almost all workspaces, and we don't want a settings page that hammers
 * Slack on every visit).
 */
type ChannelSummary = {
  id: string;
  name: string;
  isPrivate: boolean;
  isArchived: boolean;
  isMember: boolean;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDatabase();
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, session.workspaceId),
  });
  if (!ws) {
    return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  }

  const client = slackClient(decrypt(ws.encryptedOauthToken));

  const channels: ChannelSummary[] = [];
  let cursor: string | undefined;
  // Cap at ~1000 to keep response size and Slack rate-limit usage bounded.
  // Workspaces with more channels can scroll or add IDs by hand.
  for (let i = 0; i < 5; i++) {
    let res;
    try {
      res = await client.conversations.list({
        limit: 200,
        cursor,
        exclude_archived: false,
        types: "public_channel,private_channel",
      });
    } catch (e) {
      const code = (e as { data?: { error?: string } }).data?.error ?? "slack_error";
      return NextResponse.json(
        { error: `slack_list_failed:${code}` },
        { status: 502 },
      );
    }
    for (const c of res.channels ?? []) {
      if (!c.id || !c.name) continue;
      channels.push({
        id: c.id,
        name: c.name,
        isPrivate: Boolean(c.is_private),
        isArchived: Boolean(c.is_archived),
        isMember: Boolean(c.is_member),
      });
    }
    cursor = res.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }

  channels.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({
    channels,
    policy: ws.channelPolicy,
  });
}
