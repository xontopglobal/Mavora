import test from "node:test";
import assert from "node:assert/strict";
import { validateReelFile, validateStoryFile } from "./mediaValidation.js";

function file(type, size, bytes) {
  return { type, size, slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) };
}

test("accepts supported story image and video types with their media kind", async () => {
  assert.deepEqual(await validateStoryFile(file("image/webp", 10, [0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])), { extension: "webp", mediaType: "image" });
  assert.deepEqual(await validateStoryFile(file("video/mp4", 10, [0,0,0,0,0x66,0x74,0x79,0x70])), { extension: "mp4", mediaType: "video" });
});

test("rejects unsupported, oversized, and mislabelled Story media", async () => {
  await assert.rejects(validateStoryFile(file("image/svg+xml", 10, [])), /supported story media/);
  await assert.rejects(validateStoryFile(file("image/png", 10 * 1024 * 1024 + 1, [])), /at most 10 MB/);
  await assert.rejects(validateStoryFile(file("video/mp4", 50 * 1024 * 1024 + 1, [])), /at most 50 MB/);
  await assert.rejects(validateStoryFile(file("image/png", 10, [1,2,3])), /contents do not match/);
});

test("accepts supported Reels and enforces the 100 MB limit", async () => {
  assert.equal(await validateReelFile(file("video/webm", 10, [0x1a,0x45,0xdf,0xa3])), "webm");
  await assert.rejects(validateReelFile(file("video/quicktime", 10, [])), /supported reel video/);
  await assert.rejects(validateReelFile(file("video/mp4", 100 * 1024 * 1024 + 1, [])), /at most 100 MB/);
});
