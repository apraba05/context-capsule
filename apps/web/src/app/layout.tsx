import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Context Capsule",
  description:
    "The AI only ever sees the messages you hand it — and you can see exactly what that is.",
  openGraph: {
    title: "Context Capsule",
    description:
      "Curate Slack messages into immutable capsules. Your coding agent reads them, scoped and audited.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
