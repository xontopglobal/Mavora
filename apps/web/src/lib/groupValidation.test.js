import assert from "node:assert/strict";
import test from "node:test";
import { validateGroup } from "./groupValidation.js";

test("normalizes valid group fields", () => {
  assert.deepEqual(validateGroup({ name: "  Photo Walks ", description: " Meet weekly ", visibility: "public" }), {
    name: "Photo Walks", description: "Meet weekly", visibility: "public"
  });
});

test("rejects invalid names, long descriptions, and unknown visibility", () => {
  assert.throws(() => validateGroup({ name: " " }), /Group name/);
  assert.throws(() => validateGroup({ name: "Okay", description: "x".repeat(501) }), /500 characters/);
  assert.throws(() => validateGroup({ name: "Okay", visibility: "friends" }), /visibility/);
});