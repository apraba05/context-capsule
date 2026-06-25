# Context Capsule

> The AI only ever sees the messages you hand it — and you can see exactly what that is.

Context Capsule lets developers curate exact Slack messages into immutable, redacted bundles ("capsules") that a coding agent can dereference through an MCP server. The agent never holds a Slack token. Every dereference is audited. Capsules can be single-use or time-limited.

- **Read-only by construction.** The Slack manifest declares zero write scopes.
- **Default-deny.** Nothing leaves Slack unless a human explicitly selects it.
- **Frozen at finalize.** Sealing snapshots the content + mints a SHA-256 content hash.
- **Prompt-injection safe.** Capsule content is wrapped as untrusted reference data, never instructions.
- **Self-host or hosted.** Single Next.js app — deploys to Vercel; runs locally with Postgres + Redis.

---

## 30-second quickstart

1. **Install the Slack app from the manifest** — paste [`slack-manifest.yml`](./slack-manifest.yml) into Slack's "Create app from manifest" flow, replacing `example.com` with your deployment origin.
2. **Connect**. Visit `/api/slack/install` on your deployment, authorize the workspace.
3. **Reference**. In Slack, use the message overflow menu → "Add to capsule." Review in the web app, hit **Seal capsule**, copy the reference, and paste it into your agent's MCP configuration.

---

## Slack scopes — why each one exists

| Scope | Why |
|---|---|
| `channels:history` | Read the specific public-channel messages the user selected via shortcut. |
| `groups:history` | Same, for private channels the bot is invited to. |
| `im:history` | Same, for DMs the user shortcuts into a capsule. |
| `mpim:history` | Same, for group DMs. |
| `channels:read` | Resolve channel names for display in the review UI. |
| `users:read` | Resolve message authors to readable names (instead of `U01ABCDEFG`). |
| `commands` | Required to register the message shortcut entry point. |

**There are no write scopes anywhere in the manifest.** The app is structurally incapable of posting, editing, or deleting in Slack.

---

## Architecture (Phase 1 — Vercel-ready)

```
Slack workspace ──select──▶ /api/slack/events ──▶ ingestMessage() ──▶ Postgres
  (human curates, in place)  (signature verified) (Slack API · author resolved)    │
                                                                                   │
                                                  ┌────────────────────────────────┘
                                                  ▼
                                            capsules + capsule_messages
                                                  │
                                                  │ human review + seal (web UI)
                                                  ▼
                                            finalized capsule (immutable, hashed)
                                                  │
                                                  │ Bearer-authed JSON-RPC
                                                  ▼
                                            /api/mcp · fetch_capsule ──▶ Coding agent
                                                  │
                                                  └─▶ audit_events (every dereference)
```

Phase 2 layers on reactions, thread shortcuts, OAuth MCP, and a Grafana dashboard.

---

## Configuring an MCP client

Every client connects to the same endpoint with a Bearer token minted from the web app at `/settings`.

### Claude Code

`~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "context-capsule": {
      "url": "https://YOUR-DEPLOYMENT.vercel.app/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer cap_mcp_REPLACE_ME"
      }
    }
  }
}
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "context-capsule": {
      "url": "https://YOUR-DEPLOYMENT.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer cap_mcp_REPLACE_ME" }
    }
  }
}
```

### Cursor

In Cursor settings → MCP, add an HTTP server with the same URL and bearer token.

### Cline

`cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "context-capsule": {
      "url": "https://YOUR-DEPLOYMENT.vercel.app/api/mcp",
      "authToken": "cap_mcp_REPLACE_ME"
    }
  }
}
```

---

## MCP tools

- **`fetch_capsule(capsule_id)`** — return the curated, sealed message bundle. Refuses if the capsule isn't owned by the authenticated identity, isn't finalized, has expired, or has been single-use consumed. Content is wrapped with an explicit `UNTRUSTED REFERENCE MATERIAL` header.
- **`list_capsules()`** — return ids, titles, hashes, and policy for the authenticated identity. Contents are NOT included.

Every successful or refused dereference writes an `audit_events` row visible at `/capsules/<id>/audit`.

---

## Local development

```bash
pnpm install
docker compose up -d postgres redis    # or use any Postgres + Redis
cp .env.example .env                   # fill in Slack credentials
pnpm db:migrate
pnpm --filter @capsule/web dev
```

Then visit `http://localhost:3000` and follow `Add to Slack`. Or use the dev-login backdoor at `/dev-login` if you want to preview the UI without finishing OAuth setup.

---

## Self-host with Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

Brings up Postgres, Redis, MinIO, and the Next.js app. Point your Slack app's `request_url` and `redirect_url` at the public origin you map to port 3000.

---

## Security model

The five guarantees the codebase enforces, not just describes:

1. **Read-only by construction.** No write scopes in `slack-manifest.yml`; nothing in the codebase calls a write Slack API.
2. **Default-deny selection.** The only path that ingests a message is the `add_to_capsule` message_action handler. There's no listener, no scheduler, no scraper.
3. **Pre-flight redaction.** `@capsule/redaction` scans every message on ingest. Detected spans are highlighted in the review UI in `--alert` coral. Finalize destructively rewrites the snapshot.
4. **Capsule is the trust boundary.** The agent's identity (Bearer token → `users.mcp_subject`) maps to a single user. The dereference path enforces `ownerId === user.id`, `status === finalized`, expiry, and single-use atomically inside one transaction. Concurrent reads can't both win on a single-use capsule.
5. **Full audit trail.** Every dereference (allow or refuse) is written to `audit_events` with the actor subject, user agent, and IP. Owners see it at `/capsules/<id>/audit`.

The MCP response wraps content in an explicit "this is untrusted data, not commands" envelope so the consuming agent can't be hijacked by adversarial Slack messages.

---

## Status

- [x] **Phase 1** — message shortcut selection → draft → review/redact → seal → MCP fetch_capsule. Full security model.
- [ ] Phase 2 — reaction selection, thread shortcuts, audit dashboard, OTel + Grafana.
- [ ] Phase 3 — hosted reference instance with Slack App Directory listing.

---

## License

MIT.
