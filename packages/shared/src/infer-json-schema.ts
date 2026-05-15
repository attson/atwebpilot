import type { Json, JsonSchema } from "./types";

export function inferJsonSchema(value: Json): JsonSchema {
  if (value === null) return { type: "null" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }
  if (typeof value === "string") return { type: "string" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", items: {} };
    const items = mergeSchemas(value.map(inferJsonSchema));
    return { type: "array", items };
  }
  const properties: Record<string, JsonSchema> = {};
  const keys = Object.keys(value);
  for (const k of keys) {
    properties[k] = inferJsonSchema(value[k]);
  }
  return {
    type: "object",
    properties,
    required: keys
  };
}

function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];
  const allObject = schemas.every((s) => isObject(s) && (s as Record<string, Json>).type === "object");
  if (allObject) {
    const merged: Record<string, JsonSchema> = {};
    let required: string[] | null = null;
    for (const s of schemas) {
      const props = (s as Record<string, Json>).properties as Record<string, JsonSchema> | undefined;
      const req = (s as Record<string, Json>).required as string[] | undefined;
      if (props) for (const [k, v] of Object.entries(props)) merged[k] = v;
      required = required === null ? (req ?? []).slice() : (req ? required.filter((k) => req.includes(k)) : []);
    }
    return { type: "object", properties: merged, required: required ?? [] };
  }
  return schemas[0];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
