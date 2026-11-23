import test from "node:test";
import assert from "node:assert/strict";
import { validateSupportReply, validateSupportTicket } from "./supportValidation.js";

test("normalizes a valid support ticket", () => {
  assert.deepEqual(validateSupportTicket({ subject: "  Login issue ", category: "account", description: "  I cannot sign in to my account.  " }), {
    subject: "Login issue", category: "account", description: "I cannot sign in to my account."
  });
});

test("rejects invalid ticket fields", () => {
  assert.throws(() => validateSupportTicket({ subject: "x", category: "account", description: "Long enough description" }), /subject/);
  assert.throws(() => validateSupportTicket({ subject: "Subject", category: "unknown", description: "Long enough description" }), /category/);
  assert.throws(() => validateSupportTicket({ subject: "Subject", category: "other", description: "short" }), /Describe the issue/);
});

test("validates support replies", () => {
  assert.equal(validateSupportReply("  We are looking into this.  "), "We are looking into this.");
  assert.throws(() => validateSupportReply(" "), /Replies must be/);
});
