/** Pure-IO abstractions so coordinator can be exercised with FakeClock + FakeIdGen. */

export interface Clock {
  now(): number;
}

export interface IdGen {
  next(prefix?: string): string;
}

export class DefaultClock implements Clock {
  now(): number {
    return Date.now();
  }
}

export class DefaultIdGen implements IdGen {
  private counter = 0;
  next(prefix = ""): string {
    this.counter += 1;
    return `${prefix}${prefix ? "_" : ""}${Date.now().toString(36)}_${this.counter}`;
  }
}

/** For tests. Advance time by calling tick(). */
export class FakeClock implements Clock {
  constructor(private current: number = 0) {}
  now(): number {
    return this.current;
  }
  set(t: number) {
    this.current = t;
  }
  tick(ms: number) {
    this.current += ms;
  }
}

/** For tests. Yields deterministic IDs prefix_1, prefix_2, ... */
export class FakeIdGen implements IdGen {
  private counter = 0;
  next(prefix = "id"): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }
  reset() {
    this.counter = 0;
  }
}
