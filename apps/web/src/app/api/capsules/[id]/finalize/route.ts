import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { capsules, getDatabase } from "@capsule/db";
import { finalizeCapsule } from "@capsule/core";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const singleUse = Boolean(body?.singleUse);
  const expiresInHours = Number(body?.expiresInHours);
  const expiresAt =
    Number.isFinite(expiresInHours) && expiresInHours > 0
      ? new Date(Date.now() + expiresInHours * 3600_000)
      : null;

  const db = getDatabase();
  const capsule = await db.query.capsules.findFirst({
    where: and(eq(capsules.id, id), eq(capsules.ownerId, session.userId)),
  });
  if (!capsule) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sealed = await finalizeCapsule(db, capsule.id, `human:${session.userId}`, {
    singleUse,
    expiresAt,
  });

  return NextResponse.json({
    id: sealed.id,
    status: sealed.status,
    contentHash: sealed.contentHash,
    finalizedAt: sealed.finalizedAt,
  });
}
