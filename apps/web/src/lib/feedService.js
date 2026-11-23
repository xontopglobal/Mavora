import { supabase } from "./supabase";
import { validateCommentBody, validatePostBody } from "./feedValidation";

async function requireUser(expectedUserId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in to use your feed.");
  if (expectedUserId && data.user.id !== expectedUserId) {
    throw new Error("Your account session changed. Please refresh and try again.");
  }
  return data.user;
}

export async function listFeedPosts(userId) {
  const user = await requireUser(userId);
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, body, media_urls, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!posts?.length) return [];

  const postIds = posts.map((post) => post.id);
  const authorIds = [...new Set(posts.map((post) => post.author_id))];
  const [profilesResult, reactionsResult, commentsResult] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds),
    supabase.from("post_reactions").select("post_id, user_id").in("post_id", postIds),
    supabase.from("comments").select("post_id").in("post_id", postIds)
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (reactionsResult.error) throw reactionsResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const reactionRows = reactionsResult.data || [];
  const commentRows = commentsResult.data || [];
  const reactionCounts = new Map();
  const commentCounts = new Map();
  const likedByUser = new Set();
  for (const reaction of reactionRows) {
    reactionCounts.set(reaction.post_id, (reactionCounts.get(reaction.post_id) || 0) + 1);
    if (reaction.user_id === user.id) likedByUser.add(reaction.post_id);
  }
  for (const comment of commentRows) commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) || 0) + 1);

  return posts.map((post) => {
    const author = profiles.get(post.author_id);
    const externalAvatar = /^https?:\/\//i.test(author?.avatar_url || "") ? author.avatar_url : null;
    return {
      ...post,
      author: { display_name: author?.display_name, username: author?.username, avatar_url: externalAvatar },
      appreciation_count: reactionCounts.get(post.id) || 0,
      reply_count: commentCounts.get(post.id) || 0,
      appreciated_by_me: likedByUser.has(post.id)
    };
  });
}

export async function createFeedPost(userId, value) {
  const user = await requireUser(userId);
  const body = validatePostBody(value);
  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, body, visibility: "public", media_urls: [] })
    .select("id, author_id, body, media_urls, visibility, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function editFeedPost(userId, postId, value) {
  const user = await requireUser(userId);
  if (!postId) throw new Error("This post is unavailable.");
  const body = validatePostBody(value);
  const { data, error } = await supabase
    .from("posts")
    .update({ body })
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id, author_id, body, media_urls, visibility, created_at, updated_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This post could not be edited. It may have been removed or you may not own it.");
  return data;
}

export async function deleteFeedPost(userId, postId) {
  const user = await requireUser(userId);
  if (!postId) throw new Error("This post is unavailable.");
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This post could not be deleted. It may have been removed or you may not own it.");
  return data.id;
}

export async function togglePostAppreciation(userId, postId) {
  const user = await requireUser(userId);
  const { data: existing, error: readError } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("post_reactions").insert({ post_id: postId, user_id: user.id, reaction: "like" });
  if (error) throw error;
  return true;
}

export async function listPostComments(userId, postId) {
  await requireUser(userId);
  if (!postId) throw new Error("This post is unavailable.");
  const { data: comments, error } = await supabase
    .from("comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!comments?.length) return [];

  const authorIds = [...new Set(comments.map((comment) => comment.author_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", authorIds);
  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return comments.map((comment) => ({
    ...comment,
    author: profileById.get(comment.author_id) || { username: null, display_name: null, avatar_url: null }
  }));
}

export async function createPostComment(userId, postId, value) {
  const user = await requireUser(userId);
  if (!postId) throw new Error("This post is unavailable.");
  const body = validateCommentBody(value);
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: user.id, body })
    .select("id, post_id, author_id, body, created_at")
    .single();
  if (error) throw error;
  return data;
}
