import { supabase } from "./supabase";
import { avatarExtension } from "./avatarValidation";

const AVATAR_BUCKET = "avatars";
const SIGNED_AVATAR_TTL_SECONDS = 60 * 60;

const PROFILE_COLUMNS = "id, username, display_name, bio, country_code, preferred_language, preferred_currency, timezone, avatar_url, updated_at";

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
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!userId) throw new Error("Your account session is unavailable. Please sign in again.");

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Your profile could not be found. Please contact support.");
  return withAvatarDisplayUrl(data, userId);
}

export async function saveOwnProfile(userId, values) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!userId) throw new Error("Your account session is unavailable. Please sign in again.");

  const updates = {
    username: values.username.trim().toLowerCase(),
    display_name: values.display_name.trim(),
    bio: values.bio.trim(),
    country_code: values.country_code.trim().toUpperCase() || null,
    preferred_language: values.preferred_language.trim() || "en",
    preferred_currency: values.preferred_currency.trim().toUpperCase() || null,
    timezone: values.timezone.trim() || null
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("That username is already in use.");
    throw error;
  }
  return withAvatarDisplayUrl(data, userId);
}

export async function uploadOwnAvatar(userId, file) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!userId) throw new Error("Your account session is unavailable. Please sign in again.");

  const extension = avatarExtension(file);
  const currentProfile = await loadOwnProfile(userId);
  const previousPath = currentProfile.avatar_url;
  const objectPath = `${userId}/${globalThis.crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: signedData, error: signedError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(objectPath, SIGNED_AVATAR_TTL_SECONDS);
  if (signedError) {
    await removeUploadedObject(objectPath);
    throw signedError;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: objectPath })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // A transport error can arrive after PostgREST committed the update. Read
    // the profile back before deleting the candidate object; if verification
    // itself fails, preserve the object rather than risk a broken profile link.
    let pointerReadSucceeded = false;
    let pointerCommitted = false;
    try {
      const { data: current, error: readError } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();
      pointerReadSucceeded = !readError;
      pointerCommitted = pointerReadSucceeded && current?.avatar_url === objectPath;
    } catch {
      // Unknown outcome: keep the new object instead of risking a broken link.
    }
    if (pointerReadSucceeded && !pointerCommitted) await removeUploadedObject(objectPath);
    throw error;
  }

  // Do not delete previousPath here. Another tab or device may have changed
  // the profile pointer since it was read above, making that object active
  // again. Safe cleanup needs server-side coordination and is deferred.
  const cleanupWarning = previousPath && previousPath !== objectPath
    ? "Photo updated. The previous image is retained until safe cleanup is available."
    : "";
  return {
    ...data,
    avatar_display_url: signedData.signedUrl,
    avatar_cleanup_warning: cleanupWarning
  };
}
