import { describe, expect, it } from "vitest";
import { isChannelAllowed } from "../src/channel-policy";

describe("isChannelAllowed", () => {
  it("allows everything when policy is null", () => {
    expect(isChannelAllowed(null, "C01ABC")).toEqual({ allowed: true });
  });

  it("allows everything in mode 'none' even when channels are listed", () => {
    expect(
      isChannelAllowed({ mode: "none", channels: ["C01ABC"] }, "C01ABC"),
    ).toEqual({ allowed: true });
  });

  describe("blocklist mode", () => {
    it("blocks listed channels", () => {
      const out = isChannelAllowed(
        { mode: "blocklist", channels: ["C_HR", "C_FINANCE"] },
        "C_HR",
      );
      expect(out).toEqual({
        allowed: false,
        reason: "channel_blocked_by_workspace_policy",
      });
    });

    it("allows unlisted channels", () => {
      expect(
        isChannelAllowed(
          { mode: "blocklist", channels: ["C_HR"] },
          "C_ENG",
        ),
      ).toEqual({ allowed: true });
    });
  });

  describe("allowlist mode", () => {
    it("allows listed channels", () => {
      expect(
        isChannelAllowed(
          { mode: "allowlist", channels: ["C_ENG", "C_DESIGN"] },
          "C_ENG",
        ),
      ).toEqual({ allowed: true });
    });

    it("blocks channels not on the allowlist", () => {
      expect(
        isChannelAllowed(
          { mode: "allowlist", channels: ["C_ENG"] },
          "C_HR",
        ),
      ).toEqual({
        allowed: false,
        reason: "channel_not_in_workspace_allowlist",
      });
    });

    it("blocks every channel when allowlist is empty", () => {
      expect(
        isChannelAllowed({ mode: "allowlist", channels: [] }, "C_ENG"),
      ).toMatchObject({ allowed: false });
    });
  });
});
