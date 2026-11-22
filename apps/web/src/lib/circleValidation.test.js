import test from "node:test";
import assert from "node:assert/strict";
import { getFollowAction, normalizePeopleSearch, validatePeopleSearch } from "./circleValidation.js";

test("normalizes a people search term and optional username marker", () => {
  assert.equal(normalizePeopleSearch("  @ada  "), "ada");
  assert.equal(validatePeopleSearch(" Ada Okafor "), "Ada Okafor");
});

test("rejects too-short and overlong people searches", () => {
  assert.throws(() => validatePeopleSearch("a"), /at least 2 characters/);
  assert.throws(() => validatePeopleSearch("x".repeat(65)), /limited to 64 characters/);
});

test("follow action reflects an existing relationship before privacy defaults", () => {
  assert.equal(getFollowAction({ id: "u1", is_private: true }, {}), "request");
  assert.equal(getFollowAction({ id: "u1", is_private: false }, {}), "follow");
  assert.equal(getFollowAction({ id: "u1", is_private: true }, { outgoingRequestIds: new Set(["u1"]) }), "pending");
  assert.equal(getFollowAction({ id: "u1", is_private: true }, { followingIds: new Set(["u1"]) }), "following");
});
