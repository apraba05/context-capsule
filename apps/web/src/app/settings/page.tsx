import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDatabase, workspaces } from "@capsule/db";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/session";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/dev-login?next=/settings");

  const db = getDatabase();
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, session.workspaceId),
  });

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader inApp />
      <section className="container-readable py-12">
        <h1 className="text-h1 font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-body text-muted">
          Connected workspace and what's auto-removed from your messages.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-h3 font-medium">Workspace</h2>
            <p className="mt-3 text-small text-muted">Slack team</p>
            <p className="mt-1 font-medium">{workspace?.name ?? "—"}</p>
            <p className="mt-4 text-small text-muted">Slack team id</p>
            <p className="mt-1 font-mono text-small">{workspace?.slackTeamId ?? "—"}</p>
          </div>

          <div className="card p-6">
            <h2 className="text-h3 font-medium">Auto-removed</h2>
            <p className="mt-3 text-body text-muted">
              The redaction engine catches these before you seal a capsule:
            </p>
            <ul className="mt-4 space-y-2 text-small text-ink">
              <li>· Anthropic, OpenAI, GitHub, Slack, AWS, Google, and Stripe API keys</li>
              <li>· PEM-encoded private key blocks</li>
              <li>· High-entropy bearer tokens (≥4.0 bits/char)</li>
              <li>· Email addresses</li>
              <li>· US SSNs and Luhn-verified credit card numbers</li>
            </ul>
            <p className="mt-4 text-small text-muted">
              You can also remove anything by hand on the review screen.
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-h3 font-medium">MCP connection</h2>
            <p className="mt-3 text-body text-muted">
              Point your coding agent at:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-card bg-ink p-3 text-small font-mono text-paper">
{`${process.env.MCP_BASE_URL ?? "https://your-deployment.vercel.app"}/api/mcp`}
            </pre>
            <p className="mt-3 text-small text-muted">
              Use the bearer token from the dev login (Phase 1) or the OAuth flow (Phase 2).
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-h3 font-medium">Defaults</h2>
            <p className="mt-3 text-body text-muted">
              New capsules default to multi-read with no expiry. Toggle single-use per capsule on
              the review screen.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-card border border-alert-soft bg-alert-soft/40 p-6">
          <h2 className="text-h3 font-medium text-ink">Danger zone</h2>
          <p className="mt-2 text-body text-muted">
            Delete every capsule, message, and audit event tied to your account.
          </p>
          <div className="mt-4">
            <DeleteAccountForm />
          </div>
        </div>
      </section>
    </main>
  );
}
