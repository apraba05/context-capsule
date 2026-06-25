import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "channels:read",
  "users:read",
  "commands",
].join(",");

/**
 * Start the Slack OAuth v2 install flow.
 * Read-only scopes only — see the scopes table in the README.
 *
 * Doubles as the sign-in path: any user who completes this OAuth flow ends up
 * with a session in oauth_redirect. For workspaces where the bot is already
 * installed, the upsert there finds the existing workspace + user and the
 * session is set without re-issuing a duplicate token.
 */
export async function GET(req: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const base = process.env.PUBLIC_BASE_URL ?? process.env.WEB_BASE_URL;
  if (!clientId || !base) {
    return NextResponse.json(
      {
        error: "slack_not_configured",
        hint: "Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, and PUBLIC_BASE_URL.",
      },
      { status: 500 },
    );
  }

  const url0 = new URL(req.url);
  const next = url0.searchParams.get("next");

  const state = randomBytes(24).toString("base64url");
  const c = await cookies();
  c.set("capsule_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  if (next && isSafeNext(next)) {
    c.set("capsule_oauth_next", next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
  }

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", `${base}/api/slack/oauth_redirect`);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}

/** Whitelist same-origin paths only — prevents open-redirect attacks. */
function isSafeNext(next: string): boolean {
  return /^\/[a-z0-9/_\-?&=.]*$/i.test(next) && !next.startsWith("//");
}
