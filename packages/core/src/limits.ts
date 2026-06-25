import { and, count, eq, gt, sql } from "drizzle-orm";
import {
  type Database,
  auditEvents,
  capsuleMessages,
  capsules,
} from "@capsule/db";

/**
 * Rate limits + abuse prevention.
 *
 * No new infrastructure: every limit is a count over an existing table within
 * a sliding window. The accuracy is "good enough for abuse prevention" —
 * approximate counts that get re-checked on every operation.
 *
 * Limits are tunable via env (CAPSULE_LIMIT_*). The defaults match what the
 * /terms page documents — keep them in sync.
 */

export const LIMITS = {
  capsulesPerHour: numEnv("CAPSULE_LIMIT_CAPSULES_PER_HOUR", 10),
  capsulesPerDay: numEnv("CAPSULE_LIMIT_CAPSULES_PER_DAY", 100),
  messagesPerCapsule: numEnv("CAPSULE_LIMIT_MESSAGES_PER_CAPSULE", 500),
  mcpDereferencesPerMinute: numEnv("CAPSULE_LIMIT_MCP_DEREF_PER_MIN", 60),
} as const;

function numEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export type LimitDecision =
  | { ok: true }
  | { ok: false; reason: string; retryAfterSeconds?: number };

export type LimitName = keyof typeof LIMITS | "messages_per_capsule";

/**
 * Can this user create another capsule right now?
 * Enforces both the hourly and daily caps.
 */
export async function canCreateCapsule(
  db: Database,
  ownerId: string,
): Promise<LimitDecision> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [hourly] = await db
    .select({ n: count() })
    .from(capsules)
    .where(and(eq(capsules.ownerId, ownerId), gt(capsules.createdAt, hourAgo)));
  const [daily] = await db
    .select({ n: count() })
    .from(capsules)
    .where(and(eq(capsules.ownerId, ownerId), gt(capsules.createdAt, dayAgo)));

  if (hourly && hourly.n >= LIMITS.capsulesPerHour) {
    return {
      ok: false,
      reason: `Capsule creation rate exceeded (${LIMITS.capsulesPerHour}/hour). Try again later.`,
      retryAfterSeconds: 60 * 60,
    };
  }
  if (daily && daily.n >= LIMITS.capsulesPerDay) {
    return {
      ok: false,
      reason: `Daily capsule limit reached (${LIMITS.capsulesPerDay}). Try again tomorrow.`,
      retryAfterSeconds: 24 * 60 * 60,
    };
  }
  return { ok: true };
}

/**
 * Can this capsule accept another message? Enforced before any new message is
 * inserted (i.e. before contacting Slack), so we never store work we'll just
 * have to throw away.
 */
export async function canAddMessage(
  db: Database,
  capsuleId: string,
): Promise<LimitDecision> {
  const [row] = await db
    .select({ n: count() })
    .from(capsuleMessages)
    .where(eq(capsuleMessages.capsuleId, capsuleId));

  if (row && row.n >= LIMITS.messagesPerCapsule) {
    return {
      ok: false,
      reason: `This capsule has reached the ${LIMITS.messagesPerCapsule}-message cap. Seal it and start a new one.`,
    };
  }
  return { ok: true };
}

/**
 * Can this MCP actor dereference another capsule right now?
 *
 * Counts both successful and refused dereferences in the last minute — a token
 * that's spamming refused requests still gets throttled, which prevents
 * id-guessing attacks on the capsule namespace.
 */
export async function canDereference(
  db: Database,
  actorIdentity: string,
): Promise<LimitDecision> {
  const since = new Date(Date.now() - 60 * 1000);

  const [row] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.actorIdentity, actorIdentity),
        sql`${auditEvents.event} in ('dereference', 'dereference_refused')`,
        gt(auditEvents.createdAt, since),
      ),
    );

  if (row && row.n >= LIMITS.mcpDereferencesPerMinute) {
    return {
      ok: false,
      reason: `Rate limit: ${LIMITS.mcpDereferencesPerMinute} dereferences per minute. Slow down.`,
      retryAfterSeconds: 60,
    };
  }
  return { ok: true };
}
