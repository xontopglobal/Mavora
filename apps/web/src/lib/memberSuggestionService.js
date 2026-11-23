import { supabase } from "./supabase.js";

export function createMemberSuggestionService(client = supabase) {
  async function list(expectedUserId, limit = 6) {
    if (!client) throw new Error("Supabase is not configured.");
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const user = authData.user;
    if (!user) throw new Error("Sign in to see member suggestions.");
    if (expectedUserId && expectedUserId !== user.id) throw new Error("Your account session changed. Please refresh and try again.");
    const { data, error } = await client.rpc("get_my_member_suggestions", { p_limit: limit });
    if (error) throw error;
    return Promise.all((data || []).filter((profile) => profile.id !== user.id && profile.is_private !== true).map(async (profile) => {
      let avatarDisplayUrl = null;
      if (/^https?:\/\//i.test(profile.avatar_url || "")) avatarDisplayUrl = profile.avatar_url;
      else if (profile.avatar_url?.startsWith(`${profile.id}/`)) {
        const { data: signed, error: signedError } = await client.storage.from("avatars").createSignedUrl(profile.avatar_url, 1800);
        if (signedError) throw signedError;
        avatarDisplayUrl = signed.signedUrl;
      }
      return { ...profile, avatar_display_url: avatarDisplayUrl };
    }));
  }

  return { list };
}

const service = createMemberSuggestionService();
export const listMemberSuggestions = (...args) => service.list(...args);
