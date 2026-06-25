import {
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * §7 — five core tables. Keep it minimal.
 * The capsule is the trust boundary; the schema reflects that.
 */

export const capsuleStatus = pgEnum("capsule_status", ["draft", "finalized"]);

export const auditEventType = pgEnum("audit_event_type", [
  "dereference",
  "finalize",
  "redact",
  "dereference_refused",
]);

/**
 * Per-workspace channel access policy. Enforced at ingest time.
 *
 * - `none`: any channel the bot can see is fair game (default).
 * - `blocklist`: channels listed in `channels` are forbidden; everything else is allowed.
 * - `allowlist`: only channels listed in `channels` are allowed.
 *
 * Stored as Slack channel IDs (stable across renames). The UI maps IDs ↔ names
 * by calling conversations.list on demand.
 */
export type ChannelPolicy = {
  mode: "none" | "blocklist" | "allowlist";
  channels: string[];
};

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    slackTeamId: text("slack_team_id").notNull(),
    name: text("name").notNull(),
    // Envelope-encrypted Slack OAuth token. Never store plaintext.
    encryptedOauthToken: text("encrypted_oauth_token").notNull(),
    installedBy: text("installed_by").notNull(),
    channelPolicy: json("channel_policy").$type<ChannelPolicy>().notNull().default({
      mode: "none",
      channels: [],
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    teamIdUnique: uniqueIndex("workspaces_slack_team_id_idx").on(t.slackTeamId),
  }),
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    slackUserId: text("slack_user_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Identity link used by the MCP OAuth flow.
    mcpSubject: text("mcp_subject"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceUserUnique: uniqueIndex("users_workspace_slack_user_idx").on(
      t.workspaceId,
      t.slackUserId,
    ),
    mcpSubjectIdx: index("users_mcp_subject_idx").on(t.mcpSubject),
  }),
);

export const capsules = pgTable(
  "capsules",
  {
    // Public, unguessable ID (nanoid). Used as the reference handed to the agent.
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: capsuleStatus("status").notNull().default("draft"),
    title: text("title").notNull().default("Untitled capsule"),
    summary: text("summary"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    singleUse: boolean("single_use").notNull().default(false),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    // SHA-256 of the canonical, ordered, redacted message bundle. Mints at finalize.
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index("capsules_owner_idx").on(t.ownerId),
    statusIdx: index("capsules_status_idx").on(t.status),
  }),
);

export type RedactedSpan = {
  /** Inclusive char offset into the original message text. */
  start: number;
  /** Exclusive char offset. */
  end: number;
  /** Why this span was removed. */
  reason: "api_key" | "email" | "pii" | "denylist" | "manual";
  /** Optional pattern identifier (e.g. "anthropic_key"). */
  detector?: string;
};

export const capsuleMessages = pgTable(
  "capsule_messages",
  {
    id: text("id").primaryKey(),
    capsuleId: text("capsule_id")
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    slackChannelId: text("slack_channel_id").notNull(),
    slackTs: text("slack_ts").notNull(),
    // Resolved author display name + handle, snapshotted at ingest time.
    authorResolved: json("author_resolved").$type<{
      slackUserId: string;
      displayName: string;
      realName?: string;
    }>(),
    // Frozen message text. On finalize, this becomes the *redacted* snapshot.
    textSnapshot: text("text_snapshot").notNull().default(""),
    threadTs: text("thread_ts"),
    threadPosition: integer("thread_position").notNull().default(0),
    /** Review toggle — false means the message stays in the draft but is excluded from finalize. */
    included: boolean("included").notNull().default(true),
    redactedSpans: json("redacted_spans").$type<RedactedSpan[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    capsuleIdx: index("capsule_messages_capsule_idx").on(t.capsuleId),
    capsuleMessageUnique: uniqueIndex("capsule_messages_unique_idx").on(
      t.capsuleId,
      t.slackChannelId,
      t.slackTs,
    ),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    capsuleId: text("capsule_id")
      .notNull()
      .references(() => capsules.id, { onDelete: "cascade" }),
    /** OAuth subject of the agent that performed the action, or "human:<user_id>" for owner actions. */
    actorIdentity: text("actor_identity").notNull(),
    event: auditEventType("event").notNull(),
    clientMeta: json("client_meta").$type<{
      userAgent?: string;
      ip?: string;
      reason?: string;
      [k: string]: unknown;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    capsuleIdx: index("audit_events_capsule_idx").on(t.capsuleId),
    actorIdx: index("audit_events_actor_idx").on(t.actorIdentity),
  }),
);

// --- relations ---

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  capsules: many(capsules),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.workspaceId],
    references: [workspaces.id],
  }),
  capsules: many(capsules),
}));

export const capsuleRelations = relations(capsules, ({ one, many }) => ({
  owner: one(users, { fields: [capsules.ownerId], references: [users.id] }),
  workspace: one(workspaces, { fields: [capsules.workspaceId], references: [workspaces.id] }),
  messages: many(capsuleMessages),
  audits: many(auditEvents),
}));

export const capsuleMessageRelations = relations(capsuleMessages, ({ one }) => ({
  capsule: one(capsules, { fields: [capsuleMessages.capsuleId], references: [capsules.id] }),
}));

export const auditEventRelations = relations(auditEvents, ({ one }) => ({
  capsule: one(capsules, { fields: [auditEvents.capsuleId], references: [capsules.id] }),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Capsule = typeof capsules.$inferSelect;
export type NewCapsule = typeof capsules.$inferInsert;
export type CapsuleMessage = typeof capsuleMessages.$inferSelect;
export type NewCapsuleMessage = typeof capsuleMessages.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
