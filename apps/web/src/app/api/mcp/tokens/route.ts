import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase, users } from "@capsule/db";
import { getSession } from "@/lib/session";
import { mintToken } from "@/lib/mcp-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a personal MCP bearer token. The plaintext is shown to the user once
 * and then only the hash is stored. POST is intentional — token issuance is
 * a write.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token, subject } = mintToken();

  const db = getDatabase();
  await db
    .update(users)
    .set({ mcpSubject: subject })
    .where(eq(users.id, session.userId));

  return NextResponse.json({
    token,
    hint:
      "Use this as the Bearer token when configuring your agent's MCP client. " +
      "We only stored the hash — we can't recover the token if you lose it.",
  });
}
