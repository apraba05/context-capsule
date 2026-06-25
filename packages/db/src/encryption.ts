import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Envelope-style symmetric encryption used for the Slack OAuth token at rest.
 *
 * In hosted deployments this should be backed by a KMS (AWS/GCP/Vault).
 * For self-host, we derive a key from CAPSULE_ENCRYPTION_IDENTITY using scrypt.
 *
 * Format: `v1:<iv-base64>:<tag-base64>:<ciphertext-base64>`
 */

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT = "context-capsule.v1";

let cachedKey: Buffer | null = null;

function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const identity = process.env.CAPSULE_ENCRYPTION_IDENTITY;
  if (!identity || identity.length < 16) {
    throw new Error(
      "CAPSULE_ENCRYPTION_IDENTITY must be set to a strong secret (>=16 chars). " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  cachedKey = scryptSync(identity, SALT, KEY_LENGTH);
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported encryption envelope");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed encryption envelope");
  const key = deriveKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
