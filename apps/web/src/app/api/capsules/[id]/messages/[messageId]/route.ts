import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  capsuleMessages,
  capsules,
  getDatabase,
  type RedactedSpan,
} from "@capsule/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const spanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  reason: z.enum(["api_key", "email", "pii", "denylist", "manual"]),
  detector: z.string().optional(),
});

const patchSchema = z.object({
  included: z.boolean().optional(),
  spans: z.array(spanSchema).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "bad_request", details: body.error }, { status: 400 });
  }

  const db = getDatabase();

  const capsule = await db.query.capsules.findFirst({
    where: and(eq(capsules.id, id), eq(capsules.ownerId, session.userId)),
  });
  if (!capsule) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (capsule.status === "finalized") {
    return NextResponse.json({ error: "capsule_finalized" }, { status: 409 });
  }

  const patch: { included?: boolean; redactedSpans?: RedactedSpan[] } = {};
  if (body.data.included !== undefined) patch.included = body.data.included;
  if (body.data.spans !== undefined) patch.redactedSpans = body.data.spans;

  await db
    .update(capsuleMessages)
    .set(patch)
    .where(and(eq(capsuleMessages.id, messageId), eq(capsuleMessages.capsuleId, id)));

  return NextResponse.json({ ok: true });
}
