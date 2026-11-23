import test from "node:test";
import assert from "node:assert/strict";
import { createCircleService } from "./circleService.js";

function fakeClient({ rpcResults = {}, tableResults = {} } = {}) {
  const calls = [];
  const tableCallCounts = new Map();
  const tableResultForCall = (table) => {
    const callIndex = tableCallCounts.get(table) || 0;
    tableCallCounts.set(table, callIndex + 1);
    const results = tableResults[table];
    return Array.isArray(results) ? results[callIndex] || { data: [], error: null } : results || { data: [], error: null };
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "auth-user" } }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ type: "rpc", name, args });
      return rpcResults[name] || { data: null, error: null };
    },
    from: (table) => {
      const call = { type: "table", table, filters: [], selection: null, operation: "select" };
      calls.push(call);
      const builder = {
        select(columns) { call.selection = columns; return builder; },
        delete() { call.operation = "delete"; return builder; },
        eq(column, value) { call.filters.push([column, value]); return builder; },
        neq(column, value) { call.filters.push([`not-${column}`, value]); return builder; },
        in(column, values) { call.filters.push([column, values]); return builder; },
        order() { return builder; },
        limit(value) { call.limit = value; return builder; },
        maybeSingle: async () => tableResultForCall(table),
        then(resolve, reject) { return Promise.resolve(tableResultForCall(table)).then(resolve, reject); }
      };
      return builder;
    }
  };
  return { client, calls };
}

test("people search calls the backend with normalized text and excludes the signed-in user", async () => {
  const { client, calls } = fakeClient({ rpcResults: {
    search_ofsocio_people: { data: [{ id: "auth-user" }, { id: "other", username: "other" }], error: null }
  } });
  const results = await createCircleService(client).searchPeople("auth-user", "  @other ");
  assert.deepEqual(results, [{ id: "other", username: "other" }]);
  assert.deepEqual(calls[0], { type: "rpc", name: "search_ofsocio_people", args: { p_query: "other" } });
});

test("suggestions use RLS-filtered profiles and exclude followed and pending members", async () => {
  const { client, calls } = fakeClient({
    rpcResults: { get_my_follow_requests: { data: [
      { direction: "outgoing", profile_id: "pending-user" },
      { direction: "incoming", profile_id: "incoming-user" }
    ], error: null } },
    tableResults: {
      profiles: { data: [
        { id: "followed-user" }, { id: "pending-user" }, { id: "visible-new-user" }, { id: "auth-user" }
      ], error: null },
      follows: { data: [{ followed_id: "followed-user" }], error: null }
    }
  });
  const suggestions = await createCircleService(client).loadSuggestions("auth-user", 5);
  assert.deepEqual(suggestions, [{ id: "visible-new-user" }]);
  assert.deepEqual(calls.find((call) => call.table === "profiles").filters, [["not-id", "auth-user"]]);
  assert.equal(calls.find((call) => call.table === "profiles").limit, 30);
});

test("service rejects a stale client identity before it calls the backend", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(createCircleService(client).searchPeople("someone-else", "ada"), /session changed/);
  assert.equal(calls.length, 0);
});

test("follow requests use authenticated RPC ownership and prevent self-follow", async () => {
  const { client, calls } = fakeClient({ rpcResults: {
    request_ofsocio_follow: { data: "pending", error: null }
  } });
  const service = createCircleService(client);
  assert.equal(await service.followUser("auth-user", "target-user"), "pending");
  assert.deepEqual(calls[0], { type: "rpc", name: "request_ofsocio_follow", args: { p_target_id: "target-user" } });
  await assert.rejects(service.followUser("auth-user", "auth-user"), /cannot follow yourself/);
  assert.equal(calls.length, 1);
});

test("accept and reject decisions are sent through the authorized response RPC", async () => {
  const { client, calls } = fakeClient({ rpcResults: {
    respond_to_ofsocio_follow_request: { data: "accepted", error: null }
  } });
  const service = createCircleService(client);
  assert.equal(await service.respondToRequest("auth-user", "request-1", "accept"), "accepted");
  assert.deepEqual(calls[0], {
    type: "rpc",
    name: "respond_to_ofsocio_follow_request",
    args: { p_request_id: "request-1", p_decision: "accept" }
  });
});

test("incoming and outgoing request state is loaded from the authenticated backend", async () => {
  const { client } = fakeClient({
    rpcResults: { get_my_follow_requests: { data: [
      { request_id: "incoming-1", direction: "incoming", profile_id: "requester" },
      { request_id: "outgoing-1", direction: "outgoing", profile_id: "private-user" }
    ], error: null } },
    tableResults: {
      follows: [
        { data: [{ follower_id: "auth-user", followed_id: "followed-user", created_at: "2026-11-22" }], error: null },
        { data: [{ follower_id: "follower-user", followed_id: "auth-user", created_at: "2026-11-21" }], error: null }
      ],
      profiles: { data: [
        { id: "followed-user", username: "followed", is_private: false },
        { id: "follower-user", username: "follower", is_private: false }
      ], error: null }
    }
  });

  const state = await createCircleService(client).loadState("auth-user");
  assert.equal(state.following[0].profile.username, "followed");
  assert.equal(state.followers[0].profile.username, "follower");
  assert.equal(state.incomingRequests[0].request_id, "incoming-1");
  assert.equal(state.outgoingRequests[0].request_id, "outgoing-1");
});

test("rejects unsupported decisions before contacting the response RPC", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(
    createCircleService(client).respondToRequest("auth-user", "request-1", "cancel"),
    /Choose whether to accept or reject/
  );
  assert.equal(calls.length, 0);
});

test("cancel uses the owner-checked RPC and unfollow filters by the authenticated user", async () => {
  const { client, calls } = fakeClient({ rpcResults: {
    cancel_ofsocio_follow_request: { data: "cancelled", error: null }
  }, tableResults: {
    follows: { data: { follower_id: "auth-user", followed_id: "target-user" }, error: null }
  } });
  const service = createCircleService(client);
  assert.equal(await service.cancelRequest("auth-user", "request-1"), "cancelled");
  await service.unfollow("auth-user", "target-user");
  assert.deepEqual(calls[0], { type: "rpc", name: "cancel_ofsocio_follow_request", args: { p_request_id: "request-1" } });
  assert.deepEqual(calls.filter((call) => call.type === "table").map(({ table, operation, filters }) => ({ table, operation, filters })), [
    { table: "follows", operation: "delete", filters: [["follower_id", "auth-user"], ["followed_id", "target-user"]] }
  ]);
});
