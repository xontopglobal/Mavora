import assert from "node:assert/strict";
import test from "node:test";
import { uploadAvatarAndSetPointer } from "./avatarUploadFlow.js";

function setup(overrides = {}) {
  const calls = [];
  const operations = {
    upload: async () => { calls.push("upload"); return { error: null }; },
    createSignedUrl: async () => { calls.push("sign"); return { data: { signedUrl: "https://signed.example/avatar" }, error: null }; },
    updatePointer: async () => { calls.push("update"); return { data: { avatar_url: "user-a/photo.webp" }, error: null }; },
    removeObject: async () => { calls.push("remove"); return { error: null }; },
    objectPath: "user-a/photo.webp",
    ...overrides
  };
  return { calls, operations };
}

test("retains the uploaded object after an ambiguous pointer update error", async () => {
  const networkError = new TypeError("fetch failed");
  const { calls, operations } = setup({
    updatePointer: async () => { calls.push("update"); throw networkError; }
  });

  await assert.rejects(uploadAvatarAndSetPointer(operations), networkError);
  assert.deepEqual(calls, ["upload", "sign", "update"]);
});

test("retains the uploaded object after a database pointer update rejection", async () => {
  const databaseError = Object.assign(new Error("update rejected"), { code: "42501" });
  const { calls, operations } = setup({
    updatePointer: async () => { calls.push("update"); return { data: null, error: databaseError }; }
  });

  await assert.rejects(uploadAvatarAndSetPointer(operations), databaseError);
  assert.deepEqual(calls, ["upload", "sign", "update"]);
});

test("cleans up only when signed URL creation fails before the pointer update", async () => {
  const signedError = new Error("signed URL unavailable");
  const { calls, operations } = setup({
    createSignedUrl: async () => { calls.push("sign"); return { data: null, error: signedError }; }
  });

  await assert.rejects(uploadAvatarAndSetPointer(operations), signedError);
  assert.deepEqual(calls, ["upload", "sign", "remove"]);
});

test("returns the saved profile and signed URL without deleting any object", async () => {
  const { calls, operations } = setup();
  const result = await uploadAvatarAndSetPointer(operations);

  assert.deepEqual(result, {
    profile: { avatar_url: "user-a/photo.webp" },
    signedUrl: "https://signed.example/avatar"
  });
  assert.deepEqual(calls, ["upload", "sign", "update"]);
});
