import { vi } from "vitest";

export interface MockFetchOptions {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
  stream?: string[];
}

export interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export function createMockFetch(options: MockFetchOptions = {}) {
  const { status = 200, json, text, headers = {}, stream } = options;

  const captured: CapturedRequest[] = [];

  const mockFn = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const resolvedUrl =
        typeof url === "string"
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      const resolvedMethod = init?.method ?? "GET";
      const resolvedHeaders: Record<string, string> = {};

      if (init?.headers) {
        const h = init.headers;
        if (h instanceof Headers) {
          h.forEach((value, key) => {
            resolvedHeaders[key] = value;
          });
        } else if (Array.isArray(h)) {
          for (const [key, value] of h) {
            resolvedHeaders[key] = value;
          }
        } else {
          Object.assign(resolvedHeaders, h);
        }
      }

      let parsedBody: unknown = undefined;
      if (init?.body && typeof init.body === "string") {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {
          parsedBody = init.body;
        }
      }

      captured.push({
        method: resolvedMethod,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: parsedBody,
      });

      if (stream) {
        const encoder = new TextEncoder();
        const ssePayload = stream.map((line) => `${line}\n`).join("\n");
        const readableStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(ssePayload));
            controller.close();
          },
        });

        const responseHeaders = new Headers(headers);
        responseHeaders.set("content-type", "text/event-stream");

        return new Response(readableStream, {
          status,
          statusText: status === 200 ? "OK" : String(status),
          headers: responseHeaders,
        });
      }

      const responseHeaders = new Headers(headers);
      responseHeaders.set("content-type", "application/json");

      let responseBody: string | null = null;
      if (json !== undefined) {
        responseBody = JSON.stringify(json);
      } else if (text !== undefined) {
        responseBody = text;
      } else if (status === 204) {
        responseBody = null;
      }

      return new Response(responseBody, {
        status,
        statusText:
          status === 200
            ? "OK"
            : status === 204
              ? "No Content"
              : String(status),
        headers: responseHeaders,
      });
    },
  );

  return { fetch: mockFn as unknown as typeof globalThis.fetch, captured };
}

export function createErrorFetch(error: Error) {
  const mockFn = vi.fn(async () => {
    throw error;
  });
  return mockFn as unknown as typeof globalThis.fetch;
}
