import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { capsuleMessages, capsules, getDatabase } from "@capsule/db";
import { SiteHeader } from "@/components/SiteHeader";
import { CapsuleMark, SealLock } from "@/components/CapsuleMark";
import { getSession } from "@/lib/session";
import { shortHash } from "@capsule/core";

export const dynamic = "force-dynamic";

export default async function CapsulesPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/capsules");

  const db = getDatabase();
  const rows = await db
    .select({
      id: capsules.id,
      title: capsules.title,
      status: capsules.status,
      createdAt: capsules.createdAt,
      finalizedAt: capsules.finalizedAt,
      contentHash: capsules.contentHash,
      singleUse: capsules.singleUse,
      expiresAt: capsules.expiresAt,
    })
    .from(capsules)
    .where(eq(capsules.ownerId, session.userId))
    .orderBy(desc(capsules.createdAt))
    .limit(50);

  // Per-capsule counts (small N — fine to N+1 in Phase 1).
  const counts = await Promise.all(
    rows.map(async (c) => {
      const ms = await db.query.capsuleMessages.findMany({
        where: and(eq(capsuleMessages.capsuleId, c.id), eq(capsuleMessages.included, true)),
        columns: { id: true },
      });
      return [c.id, ms.length] as const;
    }),
  );
  const countMap = new Map(counts);

  const drafts = rows.filter((r) => r.status === "draft");
  const finalized = rows.filter((r) => r.status === "finalized");

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader inApp />

      <section className="container-readable py-12">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-h1 font-medium tracking-tight">Capsules</h1>
            <p className="mt-1 text-body text-muted">
              {rows.length === 0
                ? "Nothing here yet."
                : `${drafts.length} draft · ${finalized.length} sealed`}
            </p>
          </div>
          <Link href="/settings" className="btn-ghost text-small">Settings</Link>
        </header>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <CapsuleCard
                key={c.id}
                id={c.id}
                title={c.title}
                status={c.status}
                createdAt={c.createdAt}
                finalizedAt={c.finalizedAt}
                contentHash={c.contentHash}
                messageCount={countMap.get(c.id) ?? 0}
                singleUse={c.singleUse}
                expiresAt={c.expiresAt}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 card p-12">
      <div className="text-center">
        <CapsuleMark size={36} className="mx-auto opacity-60" />
        <h2 className="mt-4 text-h2 font-medium tracking-tight">Your first capsule is one shortcut away</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-muted">
          You're signed in. Now go to Slack and curate the messages you want your agent to see.
        </p>
      </div>

      <ol className="mx-auto mt-10 max-w-xl space-y-4 text-body text-ink">
        <li className="flex gap-4">
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-0.5 font-mono text-small text-accent">1</span>
          <span>Open Slack and find a message you want your agent to see.</span>
        </li>
        <li className="flex gap-4">
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-0.5 font-mono text-small text-accent">2</span>
          <span>Hover the message, click the <strong>•••</strong> menu, choose <em>Add to capsule</em>.</span>
        </li>
        <li className="flex gap-4">
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-0.5 font-mono text-small text-accent">3</span>
          <span>Come back here, review, redact, and seal the capsule.</span>
        </li>
        <li className="flex gap-4">
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-0.5 font-mono text-small text-accent">4</span>
          <span>Visit <a href="/settings" className="text-accent underline">Settings</a> to mint your MCP bearer token and point your agent at it.</span>
        </li>
      </ol>
    </div>
  );
}

function CapsuleCard({
  id,
  title,
  status,
  createdAt,
  finalizedAt,
  contentHash,
  messageCount,
  singleUse,
  expiresAt,
}: {
  id: string;
  title: string;
  status: "draft" | "finalized";
  createdAt: Date;
  finalizedAt: Date | null;
  contentHash: string | null;
  messageCount: number;
  singleUse: boolean;
  expiresAt: Date | null;
}) {
  const isDraft = status === "draft";
  return (
    <Link
      href={`/capsules/${id}`}
      className={`relative block rounded-card bg-surface p-5 transition-shadow hover:shadow-elevated ${
        isDraft ? "shadow-elevated" : ""
      }`}
    >
      <div
        className="absolute inset-0 rounded-card pointer-events-none"
        style={{
          boxShadow: `inset 0 0 0 ${isDraft ? "2px" : "2px"} ${
            isDraft ? "var(--accent)" : "var(--sealed)"
          }`,
        }}
      />
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <CapsuleMark tone={isDraft ? "accent" : "sealed"} />
          {isDraft ? (
            <span className="pill-draft">Draft</span>
          ) : (
            <span className="pill-sealed">
              <SealLock />
              Sealed
            </span>
          )}
        </div>
        <span className="text-xs text-muted">{formatAge(finalizedAt ?? createdAt)}</span>
      </header>

      <h3 className="mt-4 line-clamp-2 text-h3 font-medium">{title}</h3>

      <div className="mt-6 flex items-center justify-between text-small text-muted">
        <span>{messageCount} {messageCount === 1 ? "message" : "messages"}</span>
        {!isDraft && contentHash && (
          <span className="font-mono text-xs text-sealed">{shortHash(contentHash)}</span>
        )}
      </div>

      {(singleUse || expiresAt) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
          {singleUse && <span className="pill bg-line/60">single-use</span>}
          {expiresAt && (
            <span className="pill bg-line/60">expires {formatAge(expiresAt)}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function formatAge(d: Date): string {
  const ms = d.getTime() - Date.now();
  const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(ms);
  if (abs < 60_000) return rel.format(Math.round(ms / 1000), "second");
  if (abs < 3_600_000) return rel.format(Math.round(ms / 60_000), "minute");
  if (abs < 86_400_000) return rel.format(Math.round(ms / 3_600_000), "hour");
  return rel.format(Math.round(ms / 86_400_000), "day");
}
