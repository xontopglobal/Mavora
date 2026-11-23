import test from "node:test";
import assert from "node:assert/strict";
import { validateConversationParticipant, validateMessageBody } from "./messageValidation.js";

test("normalizes a non-empty message body", () => {
  assert.equal(validateMessageBody("  Hello there  "), "Hello there");
});

test("rejects empty and oversized message bodies", () => {
  assert.throws(() => validateMessageBody("  "), /Write a message/);
  assert.throws(() => validateMessageBody("x".repeat(5001)), /5,000 characters/);
});

test("requires a different conversation participant", () => {
  assert.equal(validateConversationParticipant("viewer", "member"), "member");
  assert.throws(() => validateConversationParticipant("viewer", "viewer"), /yourself/);
  assert.throws(() => validateConversationParticipant("viewer", ""), /Choose an Ofsocio member/);
});
