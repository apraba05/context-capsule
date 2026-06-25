import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDatabase, users } from "@capsule/db";

const COOKIE = "capsule_session";
const ONE_WEEK = 60 * 60 * 24 * 7;

export type Session = {
  userId: string;
  workspaceId: string;
  slackUserId: string;
};

/**
 * Minimal session: a signed user id cookie. In Phase 1 the source of truth
 * is the Slack OAuth flow (and a dev login backdoor for local). Replace with
 * a real auth integration (Sign in with Vercel, Clerk, Auth.js) in Phase 2.
 */
export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const userId = c.get(COOKIE)?.value;
  if (!userId) return null;
  const db = getDatabase();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  return {
    userId: user.id,
    workspaceId: user.workspaceId,
    slackUserId: user.slackUserId,
  };
}

export async function setSession(userId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
