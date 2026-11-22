import assert from "node:assert/strict";
import test from "node:test";
import { validatePostBody } from "./feedValidation.js";

test("trims and accepts a post within the schema limit", () => {
  assert.equal(validatePostBody("  Hello Ofsocio  "), "Hello Ofsocio");
});

test("rejects empty and oversized posts", () => {
  assert.throws(() => validatePostBody("  "), /Write something/);
  assert.throws(() => validatePostBody("x".repeat(5001)), /5,000 characters/);
});