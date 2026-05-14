import { describe, expect, it } from "vitest";
import { Approver } from "@/sidepanel/chat/approval";

describe("Approver run-and-always-allow", () => {
  it("delivers run-and-always-allow decision", async () => {
    const a = new Approver();
    const p = a.request("u1");
    a.resolve("u1", { kind: "run-and-always-allow", toolName: "attachTab" });
    const d = await p;
    expect(d).toEqual({ kind: "run-and-always-allow", toolName: "attachTab" });
  });
});
