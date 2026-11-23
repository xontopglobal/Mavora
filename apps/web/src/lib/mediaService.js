import { supabase } from "./supabase.js";
import { validateReelFile, validateStoryFile } from "./mediaValidation.js";

const BUCKET = "social-media";

function unwrap(response) {
  if (response?.error) throw response.error;
  return response?.data;
}

async function requireUser(client, expectedUserId) {
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in to share media.");
  if (expectedUserId && expectedUserId !== data.user.id) throw new Error("Your account session changed. Please refresh and try again.");
  return data.user;
}

function storagePath(userId, kind, extension) {
  return `${userId}/${kind}/${crypto.randomUUID()}.${extension}`;
}

async function withSignedUrl(client, row, field, urlField, expiresIn = 3600) {
  if (!row[field]) return { ...row, [urlField]: "" };
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(row[field], expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Ofsocio could not prepare a secure media link.");
  return { ...row, [urlField]: data.signedUrl };
}

export function createMediaService(client = supabase) {
  async function listStories(expectedUserId) {
    await requireUser(client, expectedUserId);
    const { data, error } = await client.from("stories")
      .select("id, user_id, media_path, media_type, caption, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = data || [];
    const ids = [...new Set(rows.map((row) => row.user_id))];
    const profileResponse = ids.length
      ? await client.from("profiles").select("id, username, display_name").in("id", ids)
      : { data: [], error: null };
    if (profileResponse.error) throw profileResponse.error;
    const profiles = new Map((profileResponse.data || []).map((profile) => [profile.id, profile]));
    return Promise.all(rows.map((row) => {
      const remaining = Math.max(1, Math.floor((Date.parse(row.expires_at) - Date.now()) / 1000));
      return withSignedUrl(client, { ...row, profile: profiles.get(row.user_id) || null }, "media_path", "media_url", Math.min(600, remaining));
    }));
  }

  async function createStory(expectedUserId, file, caption = "") {
    const user = await requireUser(client, expectedUserId);
    const { extension, mediaType } = await validateStoryFile(file);
    const cleanCaption = typeof caption === "string" ? caption.trim() : "";
    if (cleanCaption.length > 280) throw new Error("Story captions must be 280 characters or fewer.");
    const path = storagePath(user.id, "stories", extension);
    unwrap(await client.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false }));
    const response = await client.from("stories")
      .insert({ user_id: user.id, media_path: path, media_type: mediaType, caption: cleanCaption })
      .select("id, user_id, media_path, media_type, caption, created_at, expires_at")
      .single();
    if (response.error) throw new Error(`The media uploaded, but Ofsocio could not confirm the Story record: ${response.error.message}`);
    return withSignedUrl(client, response.data, "media_path", "media_url");
  }

  async function deleteStory(expectedUserId, story) {
    const user = await requireUser(client, expectedUserId);
    if (!story?.id || story.user_id !== user.id || !story.media_path) throw new Error("This Story is unavailable.");
    const deleted = await client.from("stories").delete().eq("id", story.id).eq("user_id", user.id).select("id").maybeSingle();
    if (deleted.error) throw deleted.error;
    if (!deleted.data) throw new Error("This Story is unavailable.");
    unwrap(await client.storage.from(BUCKET).remove([story.media_path]));
  }

  async function recordStoryView(expectedUserId, storyId) {
    const user = await requireUser(client, expectedUserId);
    if (!storyId) throw new Error("This Story is unavailable.");
    return unwrap(await client.rpc("record_story_view", { p_story_id: storyId }));
  }

  async function getStoryViewCount(expectedUserId, storyId) {
    const user = await requireUser(client, expectedUserId);
    if (!storyId) throw new Error("This Story is unavailable.");
    return unwrap(await client.rpc("get_my_story_view_count", { p_story_id: storyId }));
  }

  async function listReels(expectedUserId) {
    await requireUser(client, expectedUserId);
    const { data, error } = await client.from("reels")
      .select("id, creator_id, video_path, cover_path, caption, status, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const rows = data || [];
    const ids = [...new Set(rows.map((row) => row.creator_id))];
    const profileResponse = ids.length
      ? await client.from("profiles").select("id, username, display_name, avatar_url").in("id", ids)
      : { data: [], error: null };
    if (profileResponse.error) throw profileResponse.error;
    const profiles = new Map((profileResponse.data || []).map((profile) => [profile.id, profile]));
    return Promise.all(rows.map(async (row) => {
      const withVideo = await withSignedUrl(client, { ...row, creator: profiles.get(row.creator_id) || null }, "video_path", "video_url");
      return withSignedUrl(client, withVideo, "cover_path", "cover_url");
    }));
  }

  async function createReel(expectedUserId, file, caption = "") {
    const user = await requireUser(client, expectedUserId);
    const extension = await validateReelFile(file);
    const cleanCaption = typeof caption === "string" ? caption.trim() : "";
    if (cleanCaption.length > 2200) throw new Error("Reel captions must be 2,200 characters or fewer.");
    const path = storagePath(user.id, "reels", extension);
    unwrap(await client.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false }));
    const inserted = await client.from("reels")
      .insert({ creator_id: user.id, video_path: path, caption: cleanCaption })
      .select("id, creator_id, video_path, cover_path, caption, status, created_at")
      .single();
    if (inserted.error) throw new Error(`The video uploaded, but Ofsocio could not confirm the Reel record: ${inserted.error.message}`);
    const published = await client.from("reels")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", inserted.data.id)
      .eq("creator_id", user.id)
      .select("id, creator_id, video_path, cover_path, caption, status, created_at")
      .single();
    if (published.error) throw new Error(`The Reel was saved as a draft, but publishing failed: ${published.error.message}`);
    const withVideo = await withSignedUrl(client, published.data, "video_path", "video_url");
    return withSignedUrl(client, withVideo, "cover_path", "cover_url");
  }

  async function deleteReel(expectedUserId, reel) {
    const user = await requireUser(client, expectedUserId);
    if (!reel?.id || reel.creator_id !== user.id || !reel.video_path) throw new Error("This Reel is unavailable.");
    const deleted = await client.from("reels").delete().eq("id", reel.id).eq("creator_id", user.id).select("id").maybeSingle();
    if (deleted.error) throw deleted.error;
    if (!deleted.data) throw new Error("This Reel is unavailable.");
    const paths = [reel.video_path, reel.cover_path].filter(Boolean);
    const removed = await client.storage.from(BUCKET).remove(paths);
    if (removed.error) throw new Error("The Reel was deleted, but its stored media could not be removed. Contact support so it can be cleaned up.");
  }

  return { listStories, createStory, deleteStory, recordStoryView, getStoryViewCount, listReels, createReel, deleteReel };
}

const mediaService = createMediaService();
export const listStories = (...args) => mediaService.listStories(...args);
export const createStory = (...args) => mediaService.createStory(...args);
export const deleteStory = (...args) => mediaService.deleteStory(...args);
export const recordStoryView = (...args) => mediaService.recordStoryView(...args);
export const getStoryViewCount = (...args) => mediaService.getStoryViewCount(...args);
export const listReels = (...args) => mediaService.listReels(...args);
export const createReel = (...args) => mediaService.createReel(...args);
export const deleteReel = (...args) => mediaService.deleteReel(...args);
