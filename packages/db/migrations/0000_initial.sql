-- Context Capsule — baseline schema. Matches packages/db/src/schema.ts.
-- Apply with `pnpm db:migrate` once DATABASE_URL is set.

DO $$ BEGIN
  CREATE TYPE "capsule_status" AS ENUM ('draft', 'finalized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "audit_event_type" AS ENUM ('dereference', 'finalize', 'redact', 'dereference_refused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"                       text PRIMARY KEY NOT NULL,
  "slack_team_id"            text NOT NULL,
  "name"                     text NOT NULL,
  "encrypted_oauth_token"    text NOT NULL,
  "installed_by"             text NOT NULL,
  "created_at"               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slack_team_id_idx"
  ON "workspaces" ("slack_team_id");

CREATE TABLE IF NOT EXISTS "users" (
  "id"                text PRIMARY KEY NOT NULL,
  "slack_user_id"     text NOT NULL,
  "workspace_id"      text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "mcp_subject"       text,
  "created_at"        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_workspace_slack_user_idx"
  ON "users" ("workspace_id", "slack_user_id");
CREATE INDEX IF NOT EXISTS "users_mcp_subject_idx" ON "users" ("mcp_subject");

CREATE TABLE IF NOT EXISTS "capsules" (
  "id"             text PRIMARY KEY NOT NULL,
  "owner_id"       text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "workspace_id"   text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "status"         "capsule_status" NOT NULL DEFAULT 'draft',
  "title"          text NOT NULL DEFAULT 'Untitled capsule',
  "summary"        text,
  "expires_at"     timestamptz,
  "single_use"     boolean NOT NULL DEFAULT false,
  "consumed_at"    timestamptz,
  "content_hash"   text,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "finalized_at"   timestamptz
);

CREATE INDEX IF NOT EXISTS "capsules_owner_idx" ON "capsules" ("owner_id");
CREATE INDEX IF NOT EXISTS "capsules_status_idx" ON "capsules" ("status");

CREATE TABLE IF NOT EXISTS "capsule_messages" (
  "id"                  text PRIMARY KEY NOT NULL,
  "capsule_id"          text NOT NULL REFERENCES "capsules"("id") ON DELETE CASCADE,
  "slack_channel_id"    text NOT NULL,
  "slack_ts"            text NOT NULL,
  "author_resolved"     jsonb,
  "text_snapshot"       text NOT NULL DEFAULT '',
  "thread_ts"           text,
  "thread_position"     integer NOT NULL DEFAULT 0,
  "included"            boolean NOT NULL DEFAULT true,
  "redacted_spans"      jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "capsule_messages_capsule_idx"
  ON "capsule_messages" ("capsule_id");
CREATE UNIQUE INDEX IF NOT EXISTS "capsule_messages_unique_idx"
  ON "capsule_messages" ("capsule_id", "slack_channel_id", "slack_ts");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id"               text PRIMARY KEY NOT NULL,
  "capsule_id"       text NOT NULL REFERENCES "capsules"("id") ON DELETE CASCADE,
  "actor_identity"   text NOT NULL,
  "event"            "audit_event_type" NOT NULL,
  "client_meta"      jsonb,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_events_capsule_idx" ON "audit_events" ("capsule_id");
CREATE INDEX IF NOT EXISTS "audit_events_actor_idx" ON "audit_events" ("actor_identity");
