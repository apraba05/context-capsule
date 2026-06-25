-- Per-workspace channel access policy (allowlist / blocklist).
-- Defaults to {"mode":"none","channels":[]} — existing behavior preserved.

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "channel_policy" jsonb NOT NULL
  DEFAULT '{"mode":"none","channels":[]}'::jsonb;
