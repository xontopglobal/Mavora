import { supabase } from "./supabase";
import { avatarExtension } from "./avatarValidation";
import { ensureProfileRow } from "./profileBootstrap";
import { uploadAvatarAndSetPointer } from "./avatarUploadFlow";
import { normalizeCountryRegionCode } from "./profileValidation";

const AVATAR_BUCKET = "avatars";
const SIGNED_AVATAR_TTL_SECONDS = 60 * 60;
const PROFILE_COLUMNS = "id, username, display_name, bio, country_code, preferred_language, preferred_currency, timezone, avatar_url, is_private, follower_list_visibility, updated_at";

async function requireCurrentUser(expectedUserId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Your account session is unavailable. Please sign in again.");
  if (expectedUserId && data.user.id !== expectedUserId) {
    throw new Error("Your account session changed. Please refresh and try again.");
  }
  return data.user;
}

async function withAvatarDisplayUrl(profile, userId) {
  if (!profile?.avatar_url) return { ...profile, avatar_display_url: null };
  if (/^https?:\/\//i.test(profile.avatar_url)) {
    return { ...profile, avatar_display_url: profile.avatar_url };
  }
  if (!profile.avatar_url.startsWith(`${userId}/`)) {
    return { ...profile, avatar_display_url: null };
  }
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(profile.avatar_url, SIGNED_AVATAR_TTL_SECONDS);
  if (error) throw error;
  return { ...profile, avatar_display_url: data.signedUrl };
}

async function removeUploadedObject(path) {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  return error;
}

export async function loadOwnProfile(userId) {
  const user = await requireCurrentUser(userId);
  const findProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  };
  const profile = await ensureProfileRow({
    userId: user.id,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
    findProfile,
    createProfile: async (minimumRow) => {
      const { data, error } = await supabase
        .from("profiles")
        .insert(minimumRow)
        .select(PROFILE_COLUMNS)
        .single();
      if (error) throw error;
      return data;
    }
  });
  return withAvatarDisplayUrl(profile, user.id);
}

export async function saveOwnProfile(userId, values) {
  const user = await requireCurrentUser(userId);
  const updates = {
    username: values.username.trim().toLowerCase(),
    display_name: values.display_name.trim(),
    bio: values.bio.trim(),
    country_code: normalizeCountryRegionCode(values.country_code),
    preferred_language: values.preferred_language.trim() || "en",
    preferred_currency: values.preferred_currency.trim().toUpperCase() || null,
    timezone: values.timezone.trim() || null
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("That username is already in use.");
    throw error;
  }
  return withAvatarDisplayUrl(data, user.id);
}

export async function saveOwnPrivacy(userId, values) {
  const user = await requireCurrentUser(userId);
  if (typeof values?.is_private !== "boolean") throw new Error("Choose whether your profile is public or private.");
  const followerListVisibility = values.follower_list_visibility;
  if (!["public", "followers", "friends", "only_me"].includes(followerListVisibility)) {
    throw new Error("Choose who can see your follower list.");
  }
  const { data, error } = await supabase.from("profiles")
    .update({ is_private: values.is_private, follower_list_visibility: followerListVisibility })
    .eq("id", user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return withAvatarDisplayUrl(data, user.id);
}

export async function uploadOwnAvatar(userId, file) {
  const user = await requireCurrentUser(userId);
  const extension = avatarExtension(file);
  const currentProfile = await loadOwnProfile(user.id);
  const previousPath = currentProfile.avatar_url;
  const objectPath = `${user.id}/${globalThis.crypto.randomUUID()}.${extension}`;
  const { profile: data, signedUrl } = await uploadAvatarAndSetPointer({
    upload: () => supabase.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, file, { cacheControl: "3600", contentType: file.type, upsert: false }),
    createSignedUrl: () => supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(objectPath, SIGNED_AVATAR_TTL_SECONDS),
    updatePointer: () => supabase
      .from("profiles")
      .update({ avatar_url: objectPath })
      .eq("id", user.id)
      .select(PROFILE_COLUMNS)
      .single(),
    removeObject: removeUploadedObject,
    objectPath
  });

  // Previous objects are retained until coordinated server-side cleanup exists.
  const cleanupWarning = previousPath && previousPath !== objectPath
    ? "Photo updated. The previous image is retained until safe cleanup is available."
    : "";
  return { ...data, avatar_display_url: signedUrl, avatar_cleanup_warning: cleanupWarning };
}
