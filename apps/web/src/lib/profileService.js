import { supabase } from "./supabase";

const PROFILE_COLUMNS = "id, username, display_name, bio, country_code, preferred_language, preferred_currency, timezone, avatar_url, updated_at";

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
  return data;
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
  return data;
}
