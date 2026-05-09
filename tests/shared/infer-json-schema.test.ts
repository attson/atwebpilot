import { describe, expect, it } from "vitest";
import { inferJsonSchema } from "@/shared/infer-json-schema";

describe("inferJsonSchema", () => {
  it("primitives", () => {
    expect(inferJsonSchema(null)).toEqual({ type: "null" });
    expect(inferJsonSchema(true)).toEqual({ type: "boolean" });
    expect(inferJsonSchema(42)).toEqual({ type: "integer" });
    expect(inferJsonSchema(3.14)).toEqual({ type: "number" });
    expect(inferJsonSchema("hi")).toEqual({ type: "string" });
  });

  it("array of strings", () => {
    expect(inferJsonSchema(["a", "b"])).toEqual({
      type: "array",
      items: { type: "string" }
    });
  });

  it("empty array", () => {
    expect(inferJsonSchema([])).toEqual({ type: "array", items: {} });
  });

  it("object with mixed types", () => {
    expect(
      inferJsonSchema({ title: "x", count: 3, tags: ["a"] })
    ).toEqual({
      type: "object",
      properties: {
        title: { type: "string" },
        count: { type: "integer" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["title", "count", "tags"]
    });
  });

  it("array of mixed objects merges properties", () => {
    expect(
      inferJsonSchema([{ a: 1 }, { a: 2, b: "x" }])
    ).toEqual({
      type: "array",
      items: {
        type: "object",
        properties: {
          a: { type: "integer" },
          b: { type: "string" }
        },
        required: ["a"]
      }
    });
  });
});
