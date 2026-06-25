import { LegalLayout } from "@/components/LegalLayout";

export const metadata = {
  title: "Privacy — Context Capsule",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy" updated="2026-06-25">
      <p>
        This page describes what data Context Capsule collects, why, and what
        you can do about it. The intent is plain language, not legal cover.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Slack messages you explicitly select.</strong> Only the messages you
          add to a capsule via the message shortcut. We never read messages you
          did not select.
        </li>
        <li>
          <strong>Your Slack workspace + user identity.</strong> Workspace name, team
          id, your Slack user id, and display name — used to render the UI and
          scope your capsules.
        </li>
        <li>
          <strong>The Slack OAuth token for the bot.</strong> Stored encrypted at rest
          (AES-256-GCM, key derived from a deployment-specific secret).
        </li>
        <li>
          <strong>The MCP bearer-token hash.</strong> We store SHA-256 of your MCP
          token — never the token itself.
        </li>
        <li>
          <strong>Audit events.</strong> Each capsule dereference (allow or refuse)
          with timestamp, actor identity, user agent, and IP address.
        </li>
      </ul>

      <h2>What we do not store</h2>
      <ul>
        <li>Any Slack message you did not explicitly add to a capsule.</li>
        <li>The plaintext of any redacted content — redactions are destructive.</li>
        <li>Your MCP bearer token in recoverable form.</li>
        <li>Marketing trackers, third-party analytics, or fingerprints.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Capsules and audit events remain until you delete them. If you delete
        your account (see below), all your workspaces, capsules, messages, and
        audit events are removed within 24 hours.
      </p>
      <p>
        If a capsule has an expiry, it stops being readable at that time. The
        underlying messages remain in the database until you delete the capsule
        or your account.
      </p>

      <h2>Who we share data with</h2>
      <p>
        Nobody, with two infrastructure exceptions:
      </p>
      <ul>
        <li>
          <strong>Neon</strong> hosts the Postgres database (US region). Their
          privacy policy: <a href="https://neon.tech/privacy-policy">neon.tech/privacy-policy</a>.
        </li>
        <li>
          <strong>Vercel</strong> runs the web app and MCP server. Their privacy
          policy: <a href="https://vercel.com/legal/privacy-policy">vercel.com/legal/privacy-policy</a>.
        </li>
      </ul>
      <p>
        We do not sell data. We do not share data with advertisers or AI
        training pipelines.
      </p>

      <h2>Your rights</h2>
      <p>
        You can at any time:
      </p>
      <ul>
        <li>
          <strong>See</strong> all capsules + audit events scoped to you in the
          web app dashboard.
        </li>
        <li>
          <strong>Export</strong> a capsule's contents via the MCP{" "}
          <code>fetch_capsule</code> tool.
        </li>
        <li>
          <strong>Delete</strong> your account and all associated data on the
          Settings page (or by uninstalling the Slack app, which removes the
          workspace token; capsules remain until explicit deletion).
        </li>
      </ul>

      <h2>Self-hosting</h2>
      <p>
        Context Capsule is MIT-licensed open source. If you'd rather not share
        any data with this deployment, run your own:{" "}
        <a href="https://github.com/apraba05/context-capsule">github.com/apraba05/context-capsule</a>.
        Self-hosted deployments don't touch our infrastructure.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests:{" "}
        <a href="mailto:apraba05@gmail.com">apraba05@gmail.com</a>. We aim to
        respond within 7 days.
      </p>
    </LegalLayout>
  );
}
