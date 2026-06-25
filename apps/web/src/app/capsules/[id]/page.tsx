import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { capsuleMessages, capsules, getDatabase } from "@capsule/db";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/session";
import { ReviewClient } from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/dev-login?next=/capsules/${id}`);

  const db = getDatabase();
  const capsule = await db.query.capsules.findFirst({
    where: and(eq(capsules.id, id), eq(capsules.ownerId, session.userId)),
  });
  if (!capsule) notFound();

  const messages = await db.query.capsuleMessages.findMany({
    where: eq(capsuleMessages.capsuleId, capsule.id),
    orderBy: (m, { asc }) => [asc(m.slackChannelId), asc(m.slackTs)],
  });

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader inApp />
      <ReviewClient
        capsule={{
          id: capsule.id,
          title: capsule.title,
          status: capsule.status,
          contentHash: capsule.contentHash,
          singleUse: capsule.singleUse,
          expiresAt: capsule.expiresAt?.toISOString() ?? null,
        }}
        messages={messages.map((m) => ({
          id: m.id,
          slackChannelId: m.slackChannelId,
          slackTs: m.slackTs,
          author: m.authorResolved ?? { slackUserId: "?", displayName: "unknown" },
          text: m.textSnapshot,
          included: m.included,
          spans: m.redactedSpans ?? [],
        }))}
        backHref="/capsules"
        auditHref={`/capsules/${capsule.id}/audit`}
      />
    </main>
  );
}
