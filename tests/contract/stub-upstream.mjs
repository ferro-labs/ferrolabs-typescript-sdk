#!/usr/bin/env node
// Stub OpenAI-compatible upstream for the contract suite. The gateway is
// pointed at it via OPENAI_BASE_URL so chat/stream/embeddings exercise the real
// gateway code path without a provider credential. Node `http` only.
//
//   node tests/contract/stub-upstream.mjs <port>
//
// GET /_requests returns every request it has received (method, path, body)
// so a test can assert what did — or did not — reach upstream.
import http from "node:http";

const port = Number(process.argv[2] ?? process.env["STUB_PORT"] ?? 18091);
const requests = [];

const MODELS = ["gpt-4o-mini", "gpt-4o", "text-embedding-3-small"];

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function chatCompletion(model) {
  return {
    id: "chatcmpl-stub",
    object: "chat.completion",
    created: 1700000000,
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "stub reply" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  };
}

function sse(res, model, includeUsage) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
  });
  const frame = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const base = {
    id: "chatcmpl-stub",
    object: "chat.completion.chunk",
    created: 1700000000,
    model,
  };
  for (const word of ["stub", " stream", " reply"]) {
    frame({
      ...base,
      choices: [{ index: 0, delta: { content: word }, finish_reason: null }],
    });
  }
  frame({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
  if (includeUsage) {
    frame({
      ...base,
      choices: [],
      usage: { prompt_tokens: 3, completion_tokens: 3, total_tokens: 6 },
    });
  }
  res.end("data: [DONE]\n\n");
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = raw;
    }
    const path = req.url.split("?")[0];
    if (path === "/_requests") return json(res, 200, requests);
    requests.push({ method: req.method, path, body });

    if (req.method === "GET" && path === "/v1/models") {
      return json(res, 200, {
        object: "list",
        data: MODELS.map((id) => ({
          id,
          object: "model",
          created: 1700000000,
          owned_by: "openai",
        })),
      });
    }
    if (req.method === "POST" && path === "/v1/chat/completions") {
      const model = body?.model ?? "gpt-4o-mini";
      if (body?.stream)
        return sse(res, model, !!body?.stream_options?.include_usage);
      return json(res, 200, chatCompletion(model));
    }
    if (req.method === "POST" && path === "/v1/responses") {
      return json(res, 200, {
        id: "resp_stub",
        object: "response",
        created_at: 1700000000,
        status: "completed",
        model: body?.model ?? "gpt-4o-mini",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "stub response" }],
          },
        ],
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      });
    }
    if (req.method === "POST" && path === "/v1/embeddings") {
      const inputs = Array.isArray(body?.input) ? body.input : [body?.input];
      return json(res, 200, {
        object: "list",
        model: body?.model ?? "text-embedding-3-small",
        data: inputs.map((_, index) => ({
          object: "embedding",
          index,
          embedding: [0.1, 0.2, 0.3],
        })),
        usage: { prompt_tokens: inputs.length, total_tokens: inputs.length },
      });
    }
    json(res, 404, {
      error: {
        message: `stub: no route for ${req.method} ${path}`,
        type: "invalid_request_error",
        code: "not_found",
      },
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`stub upstream listening on http://127.0.0.1:${port}`);
});
