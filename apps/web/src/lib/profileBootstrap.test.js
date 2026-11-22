import assert from "node:assert/strict";
import test from "node:test";
import { ensureProfileRow } from "./profileBootstrap.js";

test("keeps an existing profile without writing over it", async () => {
  const existing = { id: "user-a", display_name: "Saved name", bio: "Keep me" };
  let creates = 0;
  const result = await ensureProfileRow({
    userId: "user-a",
    displayName: "Auth name",
    findProfile: async () => existing,
    createProfile: async () => { creates += 1; }
  });
  assert.equal(result, existing);
  assert.equal(creates, 0);
});

test("creates only the minimum profile row for the current user", async () => {
  let stored;
  const result = await ensureProfileRow({
    userId: "user-a",
    displayName: "New member",
    findProfile: async () => stored || null,
    createProfile: async (row) => (stored = row)
  });
  assert.deepEqual(result, { id: "user-a", display_name: "New member" });
});

test("recovers from a concurrent auth-trigger insert without overwriting it", async () => {
  let reads = 0;
  const saved = { id: "user-a", display_name: "Auth trigger value" };
  const result = await ensureProfileRow({
    userId: "user-a",
    displayName: "Other value",
    findProfile: async () => (++reads === 1 ? null : saved),
    createProfile: async () => { throw Object.assign(new Error("duplicate"), { code: "23505" }); }
  });
  assert.equal(result, saved);
  assert.equal(reads, 2);
});