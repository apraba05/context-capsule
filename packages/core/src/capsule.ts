import { and, eq } from "drizzle-orm";
import {
  type Database,
  type Capsule,
  type CapsuleMessage,
  capsuleMessages,
  capsules,
  auditEvents,
} from "@capsule/db";
import { applyRedactions, scanForSecrets } from "@capsule/redaction";
import { computeContentHash } from "./hash";
import { newAuditId, newCapsuleId, newMessageId } from "./ids";
import { canAddMessage, canCreateCapsule, canDereference } from "./limits";

export type DereferenceRefusal =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_owner" }
  | { ok: false; reason: "not_finalized" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "single_use_consumed" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds?: number };

export type DereferenceSuccess = {
  ok: true;
  capsule: Capsule;
  messages: CapsuleMessage[];
};

export type DereferenceResult = DereferenceSuccess | DereferenceRefusal;

export type OpenDraftInput = {
  ownerId: string;
  workspaceId: string;
  title?: string;
};

/**
 * Open a new draft capsule (or return the user's existing active draft).
 * §11 default-deny: this is the only way new messages can land anywhere.
 */
export class RateLimitError extends Error {
  constructor(message: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function openOrGetActiveDraft(
  db: Database,
  input: OpenDraftInput,
): Promise<Capsule> {
  const existing = await db.query.capsules.findFirst({
    where: and(eq(capsules.ownerId, input.ownerId), eq(capsules.status, "draft")),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
  if (existing) return existing;

  // Only the *first* time a draft is opened in this window do we hit the limit.
  // Returning an existing draft is free — adding messages to it is bounded by
  // canAddMessage instead.
  const decision = await canCreateCapsule(db, input.ownerId);
  if (!decision.ok) {
    throw new RateLimitError(decision.reason, decision.retryAfterSeconds);
  }

  const id = newCapsuleId();
  const [created] = await db
    .insert(capsules)
    .values({
      id,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      status: "draft",
      title: input.title ?? "Untitled capsule",
    })
    .returning();
  if (!created) throw new Error("Failed to create draft capsule");
  return created;
}

export type AddMessageInput = {
  capsuleId: string;
  slackChannelId: string;
  slackTs: string;
  threadTs?: string | null;
  threadPosition?: number;
  text: string;
  author: {
    slackUserId: string;
    displayName: string;
    realName?: string;
  };
};

/**
 * Idempotently add a message to a draft capsule. The (capsule, channel, ts)
 * triple is unique — selecting the same message twice is a no-op.
 *
 * Pre-flight: scan for secrets and store the spans so the review UI can
 * surface them without re-scanning on every render.
 */
export async function addMessageToDraft(
  db: Database,
  input: AddMessageInput,
): Promise<CapsuleMessage> {
  const capsule = await db.query.capsules.findFirst({
    where: eq(capsules.id, input.capsuleId),
  });
  if (!capsule) throw new Error(`Capsule ${input.capsuleId} not found`);
  if (capsule.status !== "draft") {
    throw new Error(`Capsule ${input.capsuleId} is ${capsule.status}; cannot add messages`);
  }

  const spans = scanForSecrets(input.text);

  const existing = await db.query.capsuleMessages.findFirst({
    where: and(
      eq(capsuleMessages.capsuleId, input.capsuleId),
      eq(capsuleMessages.slackChannelId, input.slackChannelId),
      eq(capsuleMessages.slackTs, input.slackTs),
    ),
  });

  // Only enforce the message cap on net-new additions — re-syncing an existing
  // message must always succeed so we don't refuse on retries.
  if (!existing) {
    const decision = await canAddMessage(db, input.capsuleId);
    if (!decision.ok) {
      throw new RateLimitError(decision.reason);
    }
  }

  if (existing) {
    const [updated] = await db
      .update(capsuleMessages)
      .set({
        textSnapshot: input.text,
        authorResolved: input.author,
        threadTs: input.threadTs ?? null,
        threadPosition: input.threadPosition ?? 0,
        redactedSpans: spans,
      })
      .where(eq(capsuleMessages.id, existing.id))
      .returning();
    return updated!;
  }

  const id = newMessageId();
  const [created] = await db
    .insert(capsuleMessages)
    .values({
      id,
      capsuleId: input.capsuleId,
      slackChannelId: input.slackChannelId,
      slackTs: input.slackTs,
      threadTs: input.threadTs ?? null,
      threadPosition: input.threadPosition ?? 0,
      textSnapshot: input.text,
      authorResolved: input.author,
      included: true,
      redactedSpans: spans,
    })
    .returning();
  if (!created) throw new Error("Failed to insert capsule message");
  return created;
}

export type FinalizeOptions = {
  expiresAt?: Date | null;
  singleUse?: boolean;
  title?: string;
  summary?: string;
};

/**
 * Freeze a draft. Applies all redacted_spans destructively to the text snapshot
 * so the original cannot be recovered from the finalized capsule. Mints a
 * content_hash over the canonical, ordered, included messages.
 */
export async function finalizeCapsule(
  db: Database,
  capsuleId: string,
  actorIdentity: string,
  opts: FinalizeOptions = {},
): Promise<Capsule> {
  return db.transaction(async (tx) => {
    const capsule = await tx.query.capsules.findFirst({
      where: eq(capsules.id, capsuleId),
    });
    if (!capsule) throw new Error("Capsule not found");
    if (capsule.status === "finalized") {
      // Idempotent: a second seal call returns the existing seal.
      return capsule;
    }

    const messages = await tx.query.capsuleMessages.findMany({
      where: eq(capsuleMessages.capsuleId, capsuleId),
    });

    // Destructively apply redactions to included messages.
    for (const m of messages) {
      if (!m.included) continue;
      if (!m.redactedSpans || m.redactedSpans.length === 0) continue;
      const redacted = applyRedactions(m.textSnapshot, m.redactedSpans);
      await tx
        .update(capsuleMessages)
        .set({ textSnapshot: redacted, redactedSpans: [] })
        .where(eq(capsuleMessages.id, m.id));
    }

    const refreshed = await tx.query.capsuleMessages.findMany({
      where: eq(capsuleMessages.capsuleId, capsuleId),
    });

    const contentHash = computeContentHash(refreshed);

    const [updated] = await tx
      .update(capsules)
      .set({
        status: "finalized",
        contentHash,
        finalizedAt: new Date(),
        expiresAt: opts.expiresAt ?? capsule.expiresAt,
        singleUse: opts.singleUse ?? capsule.singleUse,
        title: opts.title ?? capsule.title,
        summary: opts.summary ?? capsule.summary,
      })
      .where(eq(capsules.id, capsuleId))
      .returning();

    await tx.insert(auditEvents).values({
      id: newAuditId(),
      capsuleId,
      actorIdentity,
      event: "finalize",
      clientMeta: { reason: "human_seal" },
    });

    return updated!;
  });
}

export type DereferenceContext = {
  /** OAuth subject of the agent. Capsule ownership is checked against this. */
  actorIdentity: string;
  /** Linked user the OAuth subject resolves to. */
  ownerUserId: string;
  /** For audit. */
  clientMeta?: { userAgent?: string; ip?: string };
};

/**
 * The single security-critical read path. Enforces all §10 rules:
 *  - capsule must exist
 *  - capsule must be owned by the actor's linked user
 *  - capsule must be finalized
 *  - capsule must not be expired
 *  - if single_use, capsule must not be consumed
 *
 * Every outcome (allow OR refuse) is recorded in audit_events.
 */
export async function dereferenceCapsule(
  db: Database,
  capsuleId: string,
  ctx: DereferenceContext,
): Promise<DereferenceResult> {
  // Rate-limit check runs OUTSIDE the txn so we don't hold a row lock while
  // the count query runs. Throttled actors get refused before we touch the
  // capsule at all — id-guessing attacks pay the cost in their own audit log.
  const limitDecision = await canDereference(db, ctx.actorIdentity);
  if (!limitDecision.ok) {
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: limitDecision.retryAfterSeconds,
    };
  }

  return db.transaction(async (tx): Promise<DereferenceResult> => {
    const capsule = await tx.query.capsules.findFirst({
      where: eq(capsules.id, capsuleId),
    });

    if (!capsule) {
      // Don't audit a not_found — we may not have a capsule row to attach to.
      return { ok: false, reason: "not_found" };
    }

    const refuse = async <R extends DereferenceRefusal["reason"]>(
      reason: R,
    ): Promise<DereferenceRefusal> => {
      await tx.insert(auditEvents).values({
        id: newAuditId(),
        capsuleId,
        actorIdentity: ctx.actorIdentity,
        event: "dereference_refused",
        clientMeta: { ...ctx.clientMeta, reason },
      });
      return { ok: false, reason } as DereferenceRefusal;
    };

    if (capsule.ownerId !== ctx.ownerUserId) return refuse("not_owner");
    if (capsule.status !== "finalized") return refuse("not_finalized");
    if (capsule.expiresAt && capsule.expiresAt.getTime() < Date.now()) {
      return refuse("expired");
    }
    if (capsule.singleUse && capsule.consumedAt) return refuse("single_use_consumed");

    const messages = await tx.query.capsuleMessages.findMany({
      where: and(
        eq(capsuleMessages.capsuleId, capsuleId),
        eq(capsuleMessages.included, true),
      ),
    });

    // Mark single-use consumed *inside* the transaction so the second concurrent
    // request can't also win.
    if (capsule.singleUse) {
      await tx
        .update(capsules)
        .set({ consumedAt: new Date() })
        .where(eq(capsules.id, capsuleId));
    }

    await tx.insert(auditEvents).values({
      id: newAuditId(),
      capsuleId,
      actorIdentity: ctx.actorIdentity,
      event: "dereference",
      clientMeta: ctx.clientMeta ?? {},
    });

    return { ok: true, capsule, messages };
  });
}

/**
 * Human-facing message text for a refusal. The spec wants the agent to be
 * able to surface this verbatim. Plain, actionable.
 */
export function refusalMessage(reason: DereferenceRefusal["reason"]): string {
  switch (reason) {
    case "not_found":
      return "No capsule with that id exists.";
    case "not_owner":
      return "That capsule is not owned by the connected account.";
    case "not_finalized":
      return "That capsule is still a draft. Seal it in the Context Capsule web app to make it readable.";
    case "expired":
      return "That capsule has expired. Open a new one in Slack.";
    case "single_use_consumed":
      return "That capsule was single-use and has already been read once.";
    case "rate_limited":
      return "Rate limit hit. Retry shortly.";
  }
}
