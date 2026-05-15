import { describe, it, expect } from "vitest";
import { EnvelopeSchema } from "../../src/protocol/envelope";

describe("EnvelopeSchema", () => {
  it("accepts valid envelope", () => {
    const r = EnvelopeSchema.safeParse({
      nonce: "abc-123",
      ts: 1234567890,
      protocol_version: 1
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty nonce", () => {
    const r = EnvelopeSchema.safeParse({
      nonce: "",
      ts: 1,
      protocol_version: 1
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative ts", () => {
    const r = EnvelopeSchema.safeParse({
      nonce: "n",
      ts: -1,
      protocol_version: 1
    });
    expect(r.success).toBe(false);
  });

  it("rejects zero protocol_version", () => {
    const r = EnvelopeSchema.safeParse({
      nonce: "n",
      ts: 1,
      protocol_version: 0
    });
    expect(r.success).toBe(false);
  });
});
