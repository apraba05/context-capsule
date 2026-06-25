"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { RedactedSpan } from "@capsule/db";
import { CapsuleMark, SealLock } from "@/components/CapsuleMark";
import { RedactedText } from "@/components/RedactedText";

type CapsuleView = {
  id: string;
  title: string;
  status: "draft" | "finalized";
  contentHash: string | null;
  singleUse: boolean;
  expiresAt: string | null;
};

type MessageView = {
  id: string;
  slackChannelId: string;
  slackTs: string;
  author: { slackUserId: string; displayName: string; realName?: string };
  text: string;
  included: boolean;
  spans: RedactedSpan[];
};

export function ReviewClient({
  capsule,
  messages,
  backHref,
  auditHref,
}: {
  capsule: CapsuleView;
  messages: MessageView[];
  backHref: string;
  auditHref: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(messages);
  const [singleUse, setSingleUse] = useState(capsule.singleUse);
  const [pending, start] = useTransition();
  const [sealing, setSealing] = useState(false);

  const finalized = capsule.status === "finalized";
  const includedCount = local.filter((m) => m.included).length;
  const secretCount = useMemo(
    () => local.reduce((acc, m) => acc + (m.included ? m.spans.length : 0), 0),
    [local],
  );

  function toggleIncluded(messageId: string) {
    if (finalized) return;
    const next = local.map((m) => (m.id === messageId ? { ...m, included: !m.included } : m));
    setLocal(next);
    const target = next.find((m) => m.id === messageId)!;
    start(async () => {
      await fetch(`/api/capsules/${capsule.id}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ included: target.included }),
      });
      router.refresh();
    });
  }

  function removeSpan(messageId: string, index: number) {
    if (finalized) return;
    const next = local.map((m) =>
      m.id === messageId ? { ...m, spans: m.spans.filter((_, i) => i !== index) } : m,
    );
    setLocal(next);
    const target = next.find((m) => m.id === messageId)!;
    start(async () => {
      await fetch(`/api/capsules/${capsule.id}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spans: target.spans }),
      });
    });
  }

  async function seal() {
    if (finalized) return;
    setSealing(true);
    // Let the seal animation breathe.
    await new Promise((r) => setTimeout(r, 600));
    const res = await fetch(`/api/capsules/${capsule.id}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ singleUse }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setSealing(false);
    }
  }

  return (
    <section className="container-readable py-10">
      <Link href={backHref} className="text-small text-muted hover:text-ink">
        ← All capsules
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CapsuleMark tone={finalized ? "sealed" : "accent"} />
            {finalized ? (
              <span className="pill-sealed">
                <SealLock /> Sealed
              </span>
            ) : (
              <span className="pill-draft">Draft</span>
            )}
          </div>
          <h1 className="mt-3 text-h1 font-medium tracking-tight">{capsule.title}</h1>
          <p className="mt-1 text-body text-muted">
            The agent will see{" "}
            <span className="text-ink font-medium">{includedCount} messages</span>
            {secretCount > 0 && (
              <>
                {" · "}
                <span className="text-alert font-medium">{secretCount} secrets caught</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={auditHref} className="btn-ghost">Audit</Link>
          {finalized ? (
            <CopyReferenceButton id={capsule.id} />
          ) : (
            <button
              onClick={seal}
              disabled={pending || sealing || includedCount === 0}
              className="btn-accent px-5 py-3 text-body disabled:opacity-50"
            >
              {sealing ? "Sealing…" : "Seal capsule"}
            </button>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {local.length === 0 && (
            <div className="card p-10 text-center text-muted">
              Nothing in this capsule yet. Add a message from Slack.
            </div>
          )}

          {local.map((m) => (
            <article
              key={m.id}
              className={`relative rounded-card bg-surface p-5 transition-opacity ${
                m.included ? "" : "opacity-40"
              }`}
              style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}
            >
              <header className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.author.displayName}</span>
                  <span className="text-xs text-muted">
                    {m.slackChannelId} · {m.slackTs}
                  </span>
                </div>
                {!finalized && (
                  <label className="flex items-center gap-2 text-small text-muted">
                    <input
                      type="checkbox"
                      checked={m.included}
                      onChange={() => toggleIncluded(m.id)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    Include
                  </label>
                )}
              </header>
              <p className="mt-3 whitespace-pre-wrap font-mono text-small leading-relaxed text-ink">
                <RedactedText
                  text={m.text}
                  spans={m.spans}
                  finalized={finalized}
                  onToggle={(_, i) => removeSpan(m.id, i)}
                />
              </p>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <SealPanel
            capsule={capsule}
            sealing={sealing}
            includedCount={includedCount}
            secretCount={secretCount}
            singleUse={singleUse}
            setSingleUse={setSingleUse}
          />
        </aside>
      </div>
    </section>
  );
}

function SealPanel({
  capsule,
  sealing,
  includedCount,
  secretCount,
  singleUse,
  setSingleUse,
}: {
  capsule: CapsuleView;
  sealing: boolean;
  includedCount: number;
  secretCount: number;
  singleUse: boolean;
  setSingleUse: (v: boolean) => void;
}) {
  const finalized = capsule.status === "finalized";
  return (
    <div
      className={`relative card-elevated p-5 ${sealing || finalized ? "sealing" : ""}`}
      style={{
        boxShadow: finalized
          ? "inset 0 0 0 2px var(--sealed)"
          : "inset 0 0 0 2px var(--accent)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-small text-muted">Capsule</p>
        {(finalized || sealing) && (
          <span className="sealing-stamp">
            <SealLock size={18} />
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-h3 tracking-tight">{capsule.id}</p>

      {capsule.contentHash && (
        <p className="mt-4 sealing-hash">
          <span className="block text-small text-muted">Content hash</span>
          <span className="mt-1 block font-mono text-small text-sealed">
            {capsule.contentHash.slice(0, 24)}…
          </span>
        </p>
      )}

      <hr className="my-5 border-line" />

      <p className="text-small">
        <span className="font-medium">{includedCount}</span> messages will be sent.
        <br />
        <span className="font-medium">{secretCount}</span> secrets flagged.
      </p>

      {!finalized && (
        <label className="mt-5 flex items-start gap-2 text-small">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            checked={singleUse}
            onChange={(e) => setSingleUse(e.target.checked)}
          />
          <span>
            <span className="font-medium">Single use.</span>{" "}
            <span className="text-muted">The agent can dereference this capsule once.</span>
          </span>
        </label>
      )}

      {finalized && (
        <p className="mt-4 rounded-card bg-sealed-soft p-3 text-small text-sealed">
          Sealed. The agent now reads exactly these {includedCount} messages — no more, no less.
        </p>
      )}
    </div>
  );
}

function CopyReferenceButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="btn-primary px-5 py-3 text-body"
    >
      {copied ? "Copied" : "Copy reference"}
    </button>
  );
}
