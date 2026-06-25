import { LegalLayout } from "@/components/LegalLayout";

export const metadata = {
  title: "Terms — Context Capsule",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of use" updated="2026-06-25">
      <p>
        By installing the Context Capsule Slack app or using this hosted web
        app, you agree to the following.
      </p>

      <h2>What you can do</h2>
      <p>
        Install the Slack app in any workspace where you have permission. Curate
        capsules from messages you have legitimate access to. Connect a coding
        agent to your MCP endpoint using a bearer token you minted. Use the
        service for any lawful purpose, personal or commercial.
      </p>

      <h2>What you can't do</h2>
      <ul>
        <li>Use the service to violate any law or third-party right.</li>
        <li>
          Attempt to access capsules or workspaces you don't own — the system
          enforces this, but attempting it is a violation.
        </li>
        <li>
          Abuse the service: high-volume scripted requests, automated capsule
          creation beyond reasonable use, or attempts to exfiltrate other
          tenants' data.
        </li>
        <li>
          Re-host or redistribute the hosted service. The MIT license covers
          the source code; the hosted deployment at{" "}
          <code>context-capsule-seven.vercel.app</code> is for end users.
        </li>
      </ul>

      <h2>Rate limits</h2>
      <p>
        We enforce per-user and per-capsule limits to keep the service stable.
        Limits in effect (as of the last update of this page):
      </p>
      <ul>
        <li>10 capsules created per user per hour, 100 per day.</li>
        <li>500 messages per capsule.</li>
        <li>60 MCP dereferences per minute per bearer token.</li>
      </ul>
      <p>
        Limits may change without notice. Exceeding them returns a friendly
        refusal — your data isn't affected.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided "as is" with no warranty of any kind. It can
        and will go down occasionally. Don't make it the single source of truth
        for anything you can't reproduce.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent allowed by law, we are not liable for any
        indirect, incidental, special, or consequential damages arising from
        use of the service.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time on the Settings page. We can
        terminate or restrict accounts that violate these terms — we'll try to
        notify you first when reasonable.
      </p>

      <h2>Changes</h2>
      <p>
        If we change these terms in a substantive way, we'll update the date at
        the top and (when we can) email installers. Continued use after a
        change means acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:apraba05@gmail.com">apraba05@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
