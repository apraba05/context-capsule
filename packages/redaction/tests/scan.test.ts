import { describe, expect, it } from "vitest";
import { applyRedactions, mergeSpans, scanForSecrets } from "../src/scan";

/**
 * Test fixtures are assembled at runtime from prefix + body fragments so the
 * file source itself doesn't trip GitHub push-protection or other source-tree
 * secret scanners. The detectors still see a complete, valid-shaped token.
 */
const fakes = {
  anthropic: ["s" + "k-ant-api03-", "A".repeat(40)].join(""),
  openai: ["s" + "k-proj-", "B".repeat(40)].join(""),
  github: ["gh" + "p_", "C".repeat(40)].join(""),
  slack: ["xo" + "xb-", "1234567890-9876543210-", "D".repeat(20)].join(""),
  aws: "AK" + "IA" + "IOSFODNN7EXAMPLE",
  google: ["AI" + "za", "X".repeat(35)].join(""),
  stripe: ["s" + "k_test_", "0".repeat(24)].join(""),
};

describe("scanForSecrets", () => {
  it("flags planted Anthropic api keys", () => {
    const text = `key is ${fakes.anthropic} in the env`;
    const spans = scanForSecrets(text);
    expect(spans.some((s) => s.detector === "anthropic_key")).toBe(true);
  });

  it("flags openai keys", () => {
    const spans = scanForSecrets(`OPENAI_API_KEY=${fakes.openai}`);
    expect(spans.some((s) => s.reason === "api_key")).toBe(true);
  });

  it("flags github tokens", () => {
    const spans = scanForSecrets(`use this: ${fakes.github} please`);
    expect(spans.some((s) => s.detector === "github_token")).toBe(true);
  });

  it("flags slack tokens", () => {
    const spans = scanForSecrets(`token: ${fakes.slack}`);
    expect(spans.some((s) => s.detector === "slack_token")).toBe(true);
  });

  it("flags aws access keys", () => {
    const spans = scanForSecrets(`AWS_ACCESS_KEY_ID=${fakes.aws} rest of config`);
    expect(spans.some((s) => s.detector === "aws_access_key")).toBe(true);
  });

  it("flags google api keys", () => {
    const spans = scanForSecrets(`GOOGLE_API_KEY=${fakes.google}`);
    expect(spans.some((s) => s.detector === "google_api_key")).toBe(true);
  });

  it("flags stripe keys", () => {
    const spans = scanForSecrets(`STRIPE_KEY=${fakes.stripe}`);
    expect(spans.some((s) => s.detector === "stripe_key")).toBe(true);
  });

  it("flags PEM private key blocks", () => {
    const text = [
      "before",
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEA",
      "-----END RSA PRIVATE KEY-----",
      "after",
    ].join("\n");
    const spans = scanForSecrets(text);
    expect(spans.some((s) => s.detector === "private_key_block")).toBe(true);
  });

  it("flags emails", () => {
    const spans = scanForSecrets("contact alice@example.com if you need access");
    expect(spans.some((s) => s.reason === "email")).toBe(true);
  });

  it("flags SSN-shaped PII", () => {
    const spans = scanForSecrets("ssn 123-45-6789 in the leaked report");
    expect(spans.some((s) => s.detector === "us_ssn")).toBe(true);
  });

  it("flags credit cards that pass luhn", () => {
    // Visa test number — passes Luhn, designed for fixtures.
    const spans = scanForSecrets("card 4111 1111 1111 1111 declined");
    expect(spans.some((s) => s.detector === "credit_card")).toBe(true);
  });

  it("does not flag innocuous prose", () => {
    const text =
      "the team agreed we should ship by friday and revisit caching next sprint.";
    expect(scanForSecrets(text)).toEqual([]);
  });

  it("honors user denylist", () => {
    const spans = scanForSecrets("PROJECT_PHOENIX is the codename", {
      denylist: ["PROJECT_PHOENIX"],
    });
    expect(spans.some((s) => s.reason === "denylist")).toBe(true);
  });
});

describe("mergeSpans", () => {
  it("merges overlapping spans and keeps the highest-severity reason", () => {
    const merged = mergeSpans([
      { start: 0, end: 10, reason: "email" },
      { start: 5, end: 20, reason: "api_key", detector: "anthropic_key" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ start: 0, end: 20, reason: "api_key" });
  });

  it("leaves disjoint spans alone", () => {
    const merged = mergeSpans([
      { start: 0, end: 5, reason: "email" },
      { start: 10, end: 15, reason: "email" },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("applyRedactions", () => {
  it("replaces spans with [redacted:<reason>] tags", () => {
    const text = "before SECRET after";
    const spans = [{ start: 7, end: 13, reason: "api_key" as const }];
    expect(applyRedactions(text, spans)).toBe("before [redacted:api_key] after");
  });

  it("is a no-op when there are no spans", () => {
    expect(applyRedactions("hello", [])).toBe("hello");
  });

  it("removes content destructively (original cannot be recovered from output)", () => {
    const planted = fakes.anthropic;
    const text = `key: ${planted}`;
    const spans = scanForSecrets(text);
    const redacted = applyRedactions(text, spans);
    expect(redacted).not.toContain(planted);
  });
});
