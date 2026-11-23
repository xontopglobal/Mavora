import test from "node:test";
import assert from "node:assert/strict";
import { createMemberSuggestionService } from "./memberSuggestionService.js";

test("loads server-filtered public member suggestions and signs visible avatars", async () => {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "viewer" } }, error: null }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: [
        { id: "viewer", username: "me" },
        { id: "private", username: "secret", is_private: true },
        { id: "public", username: "member", display_name: "Member", avatar_url: "public/avatar.webp" }
      ], error: null };
    },
    storage: { from: (bucket) => ({ createSignedUrl: async (path) => {
      calls.push([bucket, path]);
      return { data: { signedUrl: "https://signed.example/avatar" }, error: null };
    } }) }
  };
  const rows = await createMemberSuggestionService(client).list("viewer", 5);
  assert.deepEqual(rows, [{ id: "public", username: "member", display_name: "Member", avatar_url: "public/avatar.webp", avatar_display_url: "https://signed.example/avatar" }]);
  assert.deepEqual(calls, [["get_my_member_suggestions", { p_limit: 5 }], ["avatars", "public/avatar.webp"]]);
});

test("rejects a stale session before requesting suggestions", async () => {
  let requested = false;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "current" } }, error: null }) },
    rpc: async () => { requested = true; return { data: [], error: null }; }
  };
  await assert.rejects(createMemberSuggestionService(client).list("old"), /session changed/);
  assert.equal(requested, false);
});
