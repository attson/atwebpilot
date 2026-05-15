import { describe, it, expect } from "vitest";
import { FakeClock, FakeIdGen } from "../src/clock";

describe("FakeClock", () => {
  it("starts at 0 by default", () => {
    const c = new FakeClock();
    expect(c.now()).toBe(0);
  });
  it("tick advances time", () => {
    const c = new FakeClock(100);
    c.tick(50);
    expect(c.now()).toBe(150);
  });
  it("set jumps to exact value", () => {
    const c = new FakeClock();
    c.set(9999);
    expect(c.now()).toBe(9999);
  });
});

describe("FakeIdGen", () => {
  it("yields predictable sequence", () => {
    const g = new FakeIdGen();
    expect(g.next("session")).toBe("session_1");
    expect(g.next("session")).toBe("session_2");
    expect(g.next("req")).toBe("req_3");
  });
  it("reset goes back to 0", () => {
    const g = new FakeIdGen();
    g.next("a");
    g.next("a");
    g.reset();
    expect(g.next("a")).toBe("a_1");
  });
});
