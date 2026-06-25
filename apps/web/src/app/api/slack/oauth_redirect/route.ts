import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { encrypt, getDatabase, users, workspaces } from "@capsule/db";
import { newUserId, newWorkspaceId } from "@capsule/core";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const c = await cookies();
  const expected = c.get("capsule_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }
  c.delete("capsule_oauth_state");

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const base = process.env.PUBLIC_BASE_URL ?? process.env.WEB_BASE_URL;
  if (!clientId || !clientSecret || !base) {
    return NextResponse.json({ error: "slack_not_configured" }, { status: 500 });
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${base}/api/slack/oauth_redirect`,
  });

  const resp = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await resp.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id: string; name: string };
    authed_user?: { id: string };
  };
  if (!data.ok || !data.access_token || !data.team || !data.authed_user) {
    return NextResponse.json({ error: "slack_oauth_failed", details: data.error }, { status: 400 });
  }

  const db = getDatabase();

  let ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.slackTeamId, data.team.id),
  });
  if (!ws) {
    const id = newWorkspaceId();
    const [created] = await db
      .insert(workspaces)
      .values({
        id,
        slackTeamId: data.team.id,
        name: data.team.name,
        encryptedOauthToken: encrypt(data.access_token),
        installedBy: data.authed_user.id,
      })
      .returning();
    ws = created!;
  } else {
    await db
      .update(workspaces)
      .set({ encryptedOauthToken: encrypt(data.access_token), name: data.team.name })
      .where(eq(workspaces.id, ws.id));
  }

  let user = await db.query.users.findFirst({
    where: (u, { and, eq }) =>
      and(eq(u.workspaceId, ws!.id), eq(u.slackUserId, data.authed_user!.id)),
  });
  if (!user) {
    const id = newUserId();
    const [created] = await db
      .insert(users)
      .values({
        id,
        slackUserId: data.authed_user.id,
        workspaceId: ws.id,
        mcpSubject: `slack:${ws.slackTeamId}:${data.authed_user.id}`,
      })
      .returning();
    user = created!;
  }

  await setSession(user.id);
  return NextResponse.redirect(`${base}/capsules`);
}
