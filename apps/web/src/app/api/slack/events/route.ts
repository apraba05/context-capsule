import { NextResponse } from "next/server";
import { after } from "next/server";
import { verifySlackSignature } from "@/lib/slack";
import { ingestMessage } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET ?? "";

/**
 * Single Slack endpoint:
 *  - URL verification handshake
 *  - Events API (placeholder for future event types)
 *  - Interactivity payloads (message shortcut)
 *
 * §11 default-deny: nothing here ingests by listening — every ingest is
 * triggered by an explicit human shortcut action.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const ok = verifySlackSignature({
    signingSecret: SIGNING_SECRET,
    signature: req.headers.get("x-slack-signature"),
    timestamp: req.headers.get("x-slack-request-timestamp"),
    body,
  });
  if (!ok) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // Slack URL verification (sends JSON with type: url_verification).
  if (contentType.includes("application/json")) {
    const parsed = safeJson(body);
    if (parsed?.type === "url_verification") {
      return NextResponse.json({ challenge: parsed.challenge });
    }
    return NextResponse.json({ ok: true });
  }

  // Interactivity payloads arrive form-encoded with a single `payload` field.
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    const payloadRaw = params.get("payload");
    if (!payloadRaw) return NextResponse.json({ ok: true });
    const payload = safeJson(payloadRaw);
    if (!payload) return NextResponse.json({ ok: true });

    // Message shortcut — the primary Phase 1 selection mechanism.
    if (payload.type === "message_action" && payload.callback_id === "add_to_capsule") {
      const teamId = payload.team?.id as string | undefined;
      const userId = payload.user?.id as string | undefined;
      const channel = payload.channel?.id as string | undefined;
      const ts = payload.message?.ts as string | undefined;
      const responseUrl = (payload as { response_url?: string }).response_url;

      if (!teamId || !userId || !channel || !ts) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Couldn't read the message context. Try again.",
        });
      }

      // Slack requires a response within 3s. We ack optimistically here and
      // post a follow-up via response_url once the real work is done — that
      // follow-up replaces this ack with the actual outcome (success, channel
      // policy refusal, rate limit, missing-bot-in-channel, etc).
      after(async () => {
        const result = await ingestMessage({
          teamId,
          slackUserId: userId,
          channel,
          ts,
          responseUrl,
        });
        if (!result.ok) {
          console.warn("[capsule:ingest]", {
            teamId,
            userId,
            channel,
            ts,
            kind: result.kind,
          });
        }
      });

      return NextResponse.json({
        response_type: "ephemeral",
        text: ":hourglass_flowing_sand: Adding to your capsule…",
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST events from Slack here" });
}

function safeJson(s: string): { [k: string]: unknown } & {
  type?: string;
  callback_id?: string;
  challenge?: string;
  team?: { id?: string };
  user?: { id?: string };
  channel?: { id?: string };
  message?: { ts?: string };
} | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
