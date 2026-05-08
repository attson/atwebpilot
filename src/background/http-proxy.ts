import type { Json } from "@/shared/types";

export type HttpRequestInput = {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  withCredentials: boolean;
};

export type HttpRequestOutput = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export async function httpRequest(input: HttpRequestInput): Promise<HttpRequestOutput> {
  const res = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    credentials: input.withCredentials ? "include" : "omit"
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: res.status, headers, body: await res.text() };
}

export function asJson(out: HttpRequestOutput): Json {
  return out as unknown as Json;
}
