/**
 * Image generation via the gateway.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/image-generation.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

const response = await client.images.generate({
  model: "dall-e-3",
  prompt: "A futuristic AI gateway routing data streams across glowing servers in a dark datacenter",
  size: "1024x1024",
  quality: "hd",
});

for (const image of response.data) {
  if (image.url) console.log("Image URL:", image.url);
  if (image.revised_prompt) console.log("Revised prompt:", image.revised_prompt);
}
