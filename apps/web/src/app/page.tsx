import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CapsuleMark, SealLock } from "@/components/CapsuleMark";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />

      {/* Hero — the thesis, not a stat block. */}
      <section className="container-readable pt-24 pb-32 sm:pt-32 sm:pb-40">
        <p className="text-small text-muted">For developers using AI coding agents.</p>
        <h1 className="mt-4 max-w-4xl text-[2.5rem] leading-[1.05] tracking-[-0.02em] sm:text-display font-medium">
          The AI only ever sees the messages you hand it
          <span className="text-muted"> — and you can see exactly what that is.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-body text-muted">
          Select Slack messages in place. Review and redact. Seal a capsule. Your coding agent
          dereferences it through a read-only MCP server — no Slack token in the agent, ever.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/api/slack/install" className="btn-primary px-5 py-3 text-body">
            Add to Slack
          </Link>
          <Link href="#how" className="btn-ghost px-5 py-3 text-body">
            How it works
          </Link>
        </div>

        {/* The live capsule object as the hero visual. */}
        <div className="mt-20">
          <HeroCapsule />
        </div>
      </section>

      {/* Trust story — three calm beats, §12.3. */}
      <section id="trust" className="border-t border-line bg-surface">
        <div className="container-readable py-24">
          <p className="text-small font-medium text-accent">Trust by construction</p>
          <h2 className="mt-3 max-w-3xl text-h1 font-medium tracking-tight">
            Three guarantees, each one verifiable.
          </h2>

          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            <TrustBeat
              ordinal="01"
              title="Read-only Slack scopes."
              body="The Slack app cannot post, edit, or delete anything. That's enforced by the install manifest, not a runtime check."
            />
            <TrustBeat
              ordinal="02"
              title="You curate, message by message."
              body="Nothing leaves Slack unless you explicitly select it. No background sync. No channel scraping. The capsule is exactly what you picked."
            />
            <TrustBeat
              ordinal="03"
              title="Every read is recorded."
              body="The agent reaches the capsule through an OAuth-scoped MCP endpoint. Each dereference is timestamped with actor and client in the audit log."
            />
          </div>
        </div>
      </section>

      {/* How it works. */}
      <section id="how" className="border-t border-line">
        <div className="container-readable py-24">
          <p className="text-small font-medium text-accent">How it works</p>
          <h2 className="mt-3 max-w-3xl text-h1 font-medium tracking-tight">
            Manifest → connect → reference. Thirty seconds.
          </h2>

          <ol className="mt-14 grid gap-10 sm:grid-cols-3">
            <Step
              ordinal="01"
              title="Install from the manifest."
              body="One screen of read scopes. No write permissions are requested — they don't exist in the app."
            />
            <Step
              ordinal="02"
              title="Select in Slack."
              body='In any message overflow menu, hit "Add to capsule." Or react with :capsule:. Or shortcut a whole thread.'
            />
            <Step
              ordinal="03"
              title="Hand the agent the reference."
              body="Seal the capsule, copy the id, paste it into your agent. The agent reads through MCP — never with your Slack token."
            />
          </ol>
        </div>
      </section>

      {/* Closing CTA. */}
      <section className="border-t border-line bg-surface">
        <div className="container-readable py-24">
          <div className="max-w-3xl">
            <h2 className="text-h1 font-medium tracking-tight">
              Open source. Self-host or use the hosted reference.
            </h2>
            <p className="mt-4 text-body text-muted">
              MIT licensed. <code className="font-mono text-small">docker-compose up</code> brings
              the entire system up on your own infrastructure. The code, the schema, and the audit
              trail are all yours.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/api/slack/install" className="btn-primary px-5 py-3 text-body">
                Add to Slack
              </Link>
              <a
                href="https://github.com/apraba05/context-capsule"
                className="btn-ghost px-5 py-3 text-body"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="container-readable flex flex-wrap items-center justify-between gap-4 py-10 text-small text-muted">
          <div className="flex items-center gap-2">
            <CapsuleMark size={18} />
            <span>Context Capsule</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/capsules" className="hover:text-ink">Dashboard</Link>
            <a href="https://github.com/apraba05/context-capsule" className="hover:text-ink">
              GitHub
            </a>
            <span>MIT licensed</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroCapsule() {
  // The signature visual: an open draft capsule with three messages
  // landing in, plus a finalized capsule on the right showing the wax seal.
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="card-elevated relative overflow-hidden p-7">
        <div className="absolute inset-0 pointer-events-none" style={{
          boxShadow: "inset 0 0 0 2px var(--accent)",
          borderRadius: 12,
        }} />
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CapsuleMark tone="accent" />
            <span className="text-small font-medium">#deploy-prod-incident</span>
          </div>
          <span className="pill-draft">Draft · 3 selected</span>
        </header>

        <div className="mt-6 space-y-3">
          <MessagePreview author="riley" text="rolling back to 2024.06.18. metrics show the latency spike started at 14:31 UTC." />
          <MessagePreview author="noor"  text={`cause: the new "warm pool" code path wasn't gated. patch incoming.`} />
          <MessagePreview author="dev"   text="postmortem scheduled. attaching the timeline." />
        </div>

        <footer className="mt-6 flex items-center justify-between text-small text-muted">
          <span>3 messages · 0 secrets detected</span>
          <span className="text-accent font-medium">Review → Seal capsule</span>
        </footer>
      </div>

      <div className="card relative overflow-hidden p-7">
        <div className="absolute inset-0 pointer-events-none" style={{
          boxShadow: "inset 0 0 0 2px var(--sealed)",
          borderRadius: 12,
        }} />
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CapsuleMark tone="sealed" />
            <span className="text-small font-medium">Sealed capsule</span>
          </div>
          <span className="pill-sealed"><SealLock /> Finalized</span>
        </header>

        <div className="mt-8">
          <p className="text-small text-muted">Reference</p>
          <p className="mt-1 font-mono text-h2 tracking-tight">cap_h7n3pq2k…</p>
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <p className="text-small text-muted">Content hash</p>
          <p className="mt-1 font-mono text-small text-sealed">9c1b·4f3a·d802·17e6</p>
        </div>

        <div className="mt-8 rounded-card bg-sealed-soft p-4 text-small text-sealed">
          The agent will read exactly these 3 messages — nothing else from Slack.
        </div>
      </div>
    </div>
  );
}

function MessagePreview({ author, text }: { author: string; text: string }) {
  return (
    <div className="rounded-card hairline bg-paper p-3 lands-in">
      <div className="flex items-baseline justify-between">
        <span className="text-small font-medium">{author}</span>
        <span className="text-xs text-muted">14:3{Math.floor(Math.random() * 9)} UTC</span>
      </div>
      <p className="mt-1 font-mono text-small leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function TrustBeat({
  ordinal,
  title,
  body,
}: {
  ordinal: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="font-mono text-small text-muted">{ordinal}</p>
      <h3 className="mt-3 text-h3 font-medium">{title}</h3>
      <p className="mt-2 text-body text-muted">{body}</p>
    </div>
  );
}

function Step({ ordinal, title, body }: { ordinal: string; title: string; body: string }) {
  return (
    <li>
      <p className="font-mono text-small text-accent">{ordinal}</p>
      <h3 className="mt-3 text-h3 font-medium">{title}</h3>
      <p className="mt-2 text-body text-muted">{body}</p>
    </li>
  );
}
