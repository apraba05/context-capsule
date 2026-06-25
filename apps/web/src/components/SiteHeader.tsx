import Link from "next/link";
import { CapsuleMark } from "./CapsuleMark";

export function SiteHeader({ inApp = false }: { inApp?: boolean }) {
  return (
    <header className="border-b border-line bg-paper/85 backdrop-blur">
      <div className="container-readable flex h-16 items-center justify-between">
        <Link
          href={inApp ? "/capsules" : "/"}
          className="flex items-center gap-2 text-ink"
        >
          <CapsuleMark size={22} />
          <span className="text-body font-medium tracking-tight">Context Capsule</span>
        </Link>

        <nav className="flex items-center gap-1 text-small">
          {inApp ? (
            <>
              <Link href="/capsules" className="btn-ghost">Capsules</Link>
              <Link href="/settings" className="btn-ghost">Settings</Link>
            </>
          ) : (
            <>
              <Link href="/#how" className="btn-ghost">How it works</Link>
              <Link href="/#trust" className="btn-ghost">Trust</Link>
              <Link href="/api/slack/install" className="btn-primary">Add to Slack</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
