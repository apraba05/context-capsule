import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { auditEvents, capsules, getDatabase } from "@capsule/db";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/dev-login?next=/capsules/${id}/audit`);

  const db = getDatabase();
  const capsule = await db.query.capsules.findFirst({
    where: and(eq(capsules.id, id), eq(capsules.ownerId, session.userId)),
  });
  if (!capsule) notFound();

  const events = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.capsuleId, id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader inApp />
      <section className="container-readable py-10">
        <Link href={`/capsules/${id}`} className="text-small text-muted hover:text-ink">
          ← Back to capsule
        </Link>
        <h1 className="mt-4 text-h1 font-medium tracking-tight">Audit</h1>
        <p className="mt-1 text-body text-muted">
          Every dereference and lifecycle event for <span className="font-mono">{id}</span>.
        </p>

        {events.length === 0 ? (
          <div className="mt-10 card p-12 text-center text-muted">
            No activity recorded yet.
          </div>
        ) : (
          <ol className="mt-10 space-y-3">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded-card bg-surface p-4 hairline flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <EventPill event={e.event} />
                    <span className="font-mono text-small text-muted">{e.actorIdentity}</span>
                  </div>
                  {e.clientMeta && Object.keys(e.clientMeta).length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded bg-paper p-2 font-mono text-xs text-muted">
{JSON.stringify(e.clientMeta, null, 2)}
                    </pre>
                  )}
                </div>
                <time className="text-small text-muted shrink-0">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function EventPill({ event }: { event: string }) {
  if (event === "dereference") {
    return <span className="pill-sealed">Read by agent</span>;
  }
  if (event === "dereference_refused") {
    return <span className="pill-alert">Read refused</span>;
  }
  if (event === "finalize") {
    return <span className="pill-sealed">Sealed</span>;
  }
  return <span className="pill bg-line/60 text-ink">{event}</span>;
}
