import assert from "node:assert/strict";
import test from "node:test";
import { validateCommentBody, validatePostBody } from "./feedValidation.js";

test("trims and accepts a post within the schema limit", () => {
  assert.equal(validatePostBody("  Hello Ofsocio  "), "Hello Ofsocio");
});

test("validates reply text", () => {
  assert.equal(validateCommentBody("  A thoughtful reply  "), "A thoughtful reply");
  assert.throws(() => validateCommentBody("  "), /Write a reply/);
  assert.throws(() => validateCommentBody("x".repeat(2001)), /2,000 characters/);
});

test("rejects empty and oversized posts", () => {
  assert.throws(() => validatePostBody("  "), /Write something/);
  assert.throws(() => validatePostBody("x".repeat(5001)), /5,000 characters/);
});
