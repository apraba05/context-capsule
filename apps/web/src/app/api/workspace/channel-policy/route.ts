import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDatabase, workspaces } from "@capsule/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const policySchema = z.object({
  mode: z.enum(["none", "blocklist", "allowlist"]),
  channels: z.array(z.string().regex(/^[A-Z0-9]+$/)).max(2000),
});

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = policySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", details: parsed.error.flatten() }, { status: 400 });
  }

  // De-dupe channel ids. If mode is `none`, the channels array is ignored at
  // policy-evaluation time anyway; we still keep it so the user can flip mode
  // back without losing their previous selection.
  const dedup = Array.from(new Set(parsed.data.channels));

  const db = getDatabase();
  await db
    .update(workspaces)
    .set({
      channelPolicy: { mode: parsed.data.mode, channels: dedup },
    })
    .where(eq(workspaces.id, session.workspaceId));

  return NextResponse.json({ ok: true });
}
