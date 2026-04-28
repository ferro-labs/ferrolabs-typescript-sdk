import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

const MOCK_IMAGE_RESPONSE = {
  created: 1700000000,
  data: [
    {
      url: "https://example.com/image.png",
      revised_prompt: "A beautiful sunset",
    },
  ],
};

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn });
}

describe("Images", () => {
  describe("generate", () => {
    it("sends correct body with required params", async () => {
      const { fetch, captured } = createMockFetch({
        json: MOCK_IMAGE_RESPONSE,
      });
      const client = makeClient(fetch);

      const result = await client.images.generate({
        model: "dall-e-3",
        prompt: "A sunset over mountains",
      });

      expect(result).toEqual(MOCK_IMAGE_RESPONSE);

      const req = captured[0]!;
      expect(req.method).toBe("POST");
      expect(req.url).toContain("/v1/images/generations");
      expect(req.body).toEqual({
        model: "dall-e-3",
        prompt: "A sunset over mountains",
      });
    });

    it("only includes optional params when set", async () => {
      const { fetch, captured } = createMockFetch({
        json: MOCK_IMAGE_RESPONSE,
      });
      const client = makeClient(fetch);

      await client.images.generate({
        model: "dall-e-3",
        prompt: "test",
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body).not.toHaveProperty("n");
      expect(body).not.toHaveProperty("size");
      expect(body).not.toHaveProperty("quality");
      expect(body).not.toHaveProperty("response_format");
      expect(body).not.toHaveProperty("style");
      expect(body).not.toHaveProperty("user");
    });

    it("includes optional params when provided", async () => {
      const { fetch, captured } = createMockFetch({
        json: MOCK_IMAGE_RESPONSE,
      });
      const client = makeClient(fetch);

      await client.images.generate({
        model: "dall-e-3",
        prompt: "test",
        n: 2,
        size: "1024x1024",
        quality: "hd",
        response_format: "b64_json",
        style: "vivid",
        user: "user-1",
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body["n"]).toBe(2);
      expect(body["size"]).toBe("1024x1024");
      expect(body["quality"]).toBe("hd");
      expect(body["response_format"]).toBe("b64_json");
      expect(body["style"]).toBe("vivid");
      expect(body["user"]).toBe("user-1");
    });
  });
});
