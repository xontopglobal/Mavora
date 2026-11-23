import assert from "node:assert/strict";
import test from "node:test";
import { validateReport } from "./reportValidation.js";

const postId = "a368795d-c937-417f-89d0-7ba92037d159";

test("validates and normalizes a supported post report", () => {
  assert.deepEqual(validateReport({ targetType: "post", targetId: postId, reason: "spam", description: "This looks like a repeated scam link." }), {
    target_type: "post", target_id: postId, reason: "spam", description: "This looks like a repeated scam link."
  });
});

test("accepts account reports using the same validated report categories", () => {
  assert.deepEqual(validateReport({ targetType: "account", targetId: postId, reason: "impersonation", description: "This profile appears to impersonate someone." }), {
    target_type: "account", target_id: postId, reason: "impersonation", description: "This profile appears to impersonate someone."
  });
});

test("rejects unsupported targets, malformed ids, and missing reasons", () => {
  assert.throws(() => validateReport({ targetType: "message", targetId: postId, reason: "spam" }), /cannot be reported/);
  assert.throws(() => validateReport({ targetType: "post", targetId: "post-1", reason: "spam" }), /unavailable/);
  assert.throws(() => validateReport({ targetType: "post", targetId: postId, reason: "" }), /Choose a reason/);
});

test("requires a bounded report description", () => {
  assert.throws(() => validateReport({ targetType: "post", targetId: postId, reason: "other", description: "short" }), /description between 10 and 2,000/);
  assert.throws(() => validateReport({ targetType: "post", targetId: postId, reason: "other", description: "x".repeat(2001) }), /description between 10 and 2,000/);
});
