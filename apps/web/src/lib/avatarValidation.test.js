import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_MAX_BYTES, avatarExtension } from "./avatarValidation.js";

test("accepts supported image types and returns safe extensions", () => {
  assert.equal(avatarExtension({ type: "image/jpeg", size: 1 }), "jpg");
  assert.equal(avatarExtension({ type: "image/png", size: 1 }), "png");
  assert.equal(avatarExtension({ type: "image/webp", size: 1 }), "webp");
});

test("rejects unsupported MIME labels", () => {
  assert.throws(() => avatarExtension({ type: "image/svg+xml", size: 1 }), /JPEG, PNG, or WebP/);
  assert.throws(() => avatarExtension({ type: "application/pdf", size: 1 }), /JPEG, PNG, or WebP/);
});

test("rejects empty, oversized, and malformed files", () => {
  assert.throws(() => avatarExtension({ type: "image/jpeg", size: 0 }), /smaller than 5 MB/);
  assert.throws(() => avatarExtension({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 }), /smaller than 5 MB/);
  assert.throws(() => avatarExtension(null), /Choose an image file/);
});
