import Link from "next/link";
import { SiteHeader } from "./SiteHeader";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <article className="container-readable max-w-3xl py-16">
        <Link href="/" className="text-small text-muted hover:text-ink">
          ← Home
        </Link>
        <h1 className="mt-4 text-h1 font-medium tracking-tight">{title}</h1>
        <p className="mt-2 text-small text-muted">Last updated {updated}.</p>
        <div className="prose prose-neutral mt-10 max-w-none text-body leading-relaxed [&_h2]:mt-12 [&_h2]:text-h2 [&_h2]:font-medium [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-h3 [&_h3]:font-medium [&_p]:mt-4 [&_p]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-2 [&_a]:text-accent [&_a]:underline">
          {children}
        </div>
      </article>
    </main>
  );
}
