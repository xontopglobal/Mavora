import { supabase } from "./supabase.js";
import { validatePeopleSearch } from "./circleValidation.js";

const PROFILE_COLUMNS = "id, username, display_name, avatar_url, is_private";

function unwrap(response) {
  if (response?.error) throw response.error;
  return response?.data;
}

export function createCircleService(client = supabase) {
  async function requireUser(expectedUserId) {
    if (!client) throw new Error("Supabase is not configured.");
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Sign in to use Circles.");
    if (expectedUserId && expectedUserId !== data.user.id) {
      throw new Error("Your account session changed. Please refresh and try again.");
    }
    return data.user;
  }

  async function searchPeople(expectedUserId, value) {
    const user = await requireUser(expectedUserId);
    const query = validatePeopleSearch(value);
    const rows = unwrap(await client.rpc("search_ofsocio_people", { p_query: query }));
    return (rows || []).filter((profile) => profile.id !== user.id);
  }

  async function loadState(expectedUserId) {
    const user = await requireUser(expectedUserId);
    const [followingResponse, followersResponse, requestResponse] = await Promise.all([
      client.from("follows")
        .select("follower_id, followed_id, created_at")
        .eq("follower_id", user.id)
        .order("created_at", { ascending: false }),
      client.from("follows")
        .select("follower_id, followed_id, created_at")
        .eq("followed_id", user.id)
        .order("created_at", { ascending: false }),
      client.rpc("get_my_follow_requests")
    ]);

    const following = unwrap(followingResponse) || [];
    const followers = unwrap(followersResponse) || [];
    const requests = unwrap(requestResponse) || [];
    const profileIds = [...new Set([
      ...following.map((row) => row.followed_id),
      ...followers.map((row) => row.follower_id)
    ])].filter((id) => id && id !== user.id);

    let profiles = [];
    if (profileIds.length) {
      const response = await client.from("profiles").select(PROFILE_COLUMNS).in("id", profileIds);
      profiles = unwrap(response) || [];
    }
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const enrich = (row, profileId) => ({
      ...row,
      profile: profileById.get(profileId) || { id: profileId, username: null, display_name: null, avatar_url: null, is_private: null }
    });

    return {
      following: following.map((row) => enrich(row, row.followed_id)),
      followers: followers.map((row) => enrich(row, row.follower_id)),
      incomingRequests: requests.filter((request) => request.direction === "incoming"),
      outgoingRequests: requests.filter((request) => request.direction === "outgoing")
    };
  }

  async function followUser(expectedUserId, targetId) {
    const user = await requireUser(expectedUserId);
    if (!targetId || targetId === user.id) throw new Error("You cannot follow yourself.");
    return unwrap(await client.rpc("request_ofsocio_follow", { p_target_id: targetId }));
  }

  async function cancelRequest(expectedUserId, requestId) {
    await requireUser(expectedUserId);
    if (!requestId) throw new Error("This follow request is unavailable.");
    return unwrap(await client.rpc("cancel_ofsocio_follow_request", { p_request_id: requestId }));
  }

  async function respondToRequest(expectedUserId, requestId, decision) {
    await requireUser(expectedUserId);
    if (!requestId || !["accept", "reject"].includes(decision)) {
      throw new Error("Choose whether to accept or reject this request.");
    }
    return unwrap(await client.rpc("respond_to_ofsocio_follow_request", {
      p_request_id: requestId,
      p_decision: decision
    }));
  }

  async function unfollow(expectedUserId, targetId) {
    const user = await requireUser(expectedUserId);
    if (!targetId || targetId === user.id) throw new Error("This follow relationship is unavailable.");
    const response = await client.from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followed_id", targetId)
      .select("follower_id, followed_id")
      .maybeSingle();
    const deleted = unwrap(response);
    if (!deleted) throw new Error("You are no longer following this member.");
    return deleted;
  }

  return { searchPeople, loadState, followUser, cancelRequest, respondToRequest, unfollow };
}

const circleService = createCircleService();
export const searchPeople = (...args) => circleService.searchPeople(...args);
export const loadCircleState = (...args) => circleService.loadState(...args);
export const followUser = (...args) => circleService.followUser(...args);
export const cancelFollowRequest = (...args) => circleService.cancelRequest(...args);
export const respondToFollowRequest = (...args) => circleService.respondToRequest(...args);
export const unfollowUser = (...args) => circleService.unfollow(...args);
