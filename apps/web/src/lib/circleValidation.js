const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 64;

export function normalizePeopleSearch(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "").trim();
}

export function validatePeopleSearch(value) {
  const query = normalizePeopleSearch(value);
  if (query.length < MIN_QUERY_LENGTH) {
    throw new Error("Enter at least 2 characters to search for people.");
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(`Search is limited to ${MAX_QUERY_LENGTH} characters.`);
  }
  return query;
}

export function getFollowAction(profile, relationships = {}) {
  if (!profile?.id) return "unavailable";
  if (relationships.followingIds?.has(profile.id)) return "following";
  if (relationships.outgoingRequestIds?.has(profile.id)) return "pending";
  return profile.is_private ? "request" : "follow";
}
