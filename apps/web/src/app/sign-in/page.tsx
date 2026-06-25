import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CapsuleMark } from "@/components/CapsuleMark";

export const metadata = {
  title: "Sign in — Context Capsule",
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const devAllowed =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "1";

  // Slack's OAuth install URL doubles as our sign-in flow: it identifies the
  // installer and creates a session in the oauth_redirect callback. For users
  // in a workspace where the bot is already installed, the flow short-circuits
  // — Slack returns immediately, the upsert finds the existing user, session
  // is set. So one button covers first install AND every subsequent sign in.
  const installHref = `/api/slack/install${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="container-readable flex items-center justify-center py-24">
        <div className="card-elevated w-full max-w-md p-10">
          <CapsuleMark size={32} />
          <h1 className="mt-6 text-h1 font-medium tracking-tight">Sign in</h1>
          <p className="mt-2 text-body text-muted">
            Context Capsule uses your Slack account. We only request read scopes —
            you can review them on Slack's consent screen before approving.
          </p>

          <Link
            href={installHref}
            className="btn-primary mt-8 w-full py-3 text-body"
          >
            <SlackMark />
            Continue with Slack
          </Link>

          <p className="mt-6 text-small text-muted">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline hover:text-ink">terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-ink">privacy policy</Link>.
          </p>

          {devAllowed && (
            <details className="mt-6 text-small text-muted">
              <summary className="cursor-pointer hover:text-ink">
                Local development?
              </summary>
              <p className="mt-2">
                Use the{" "}
                <Link
                  href={`/dev-login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
                  className="underline hover:text-ink"
                >
                  dev login backdoor
                </Link>{" "}
                — only available when ALLOW_DEV_LOGIN=1 or in non-production envs.
              </p>
            </details>
          )}
        </div>
      </section>
    </main>
  );
}

function SlackMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E01E5A" d="M5 15a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 0 1 4 0v5a2 2 0 1 1-4 0v-5z" />
      <path fill="#36C5F0" d="M9 5a2 2 0 1 1 2-2v2H9zm0 1a2 2 0 0 1 0 4H4a2 2 0 1 1 0-4h5z" />
      <path fill="#2EB67D" d="M19 9a2 2 0 1 1 2 2h-2V9zm-1 0a2 2 0 0 1-4 0V4a2 2 0 1 1 4 0v5z" />
      <path fill="#ECB22E" d="M15 19a2 2 0 1 1-2 2v-2h2zm0-1a2 2 0 0 1 0-4h5a2 2 0 1 1 0 4h-5z" />
    </svg>
  );
}
