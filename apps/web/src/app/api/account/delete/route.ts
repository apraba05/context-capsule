import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { capsules, getDatabase, users, workspaces } from "@capsule/db";
import { clearSession, getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-service account deletion — GDPR Article 17 / "right to be forgotten."
 *
 * Deletes the user's capsules first (cascades to messages + audit events),
 * then the user, then garbage-collects the workspace if no users remain.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDatabase();

  await db.transaction(async (tx) => {
    await tx.delete(capsules).where(eq(capsules.ownerId, session.userId));
    await tx.delete(users).where(eq(users.id, session.userId));

    const remaining = await tx.query.users.findMany({
      where: eq(users.workspaceId, session.workspaceId),
      columns: { id: true },
      limit: 1,
    });
    if (remaining.length === 0) {
      await tx.delete(workspaces).where(eq(workspaces.id, session.workspaceId));
    }
  });

  await clearSession();
  return NextResponse.json({ ok: true });
}
