import { supabase } from "./supabase";
import { validateGroup } from "./groupValidation";

async function requireUser(expectedUserId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in to use groups.");
  if (expectedUserId && data.user.id !== expectedUserId) {
    throw new Error("Your account session changed. Please refresh and try again.");
  }
  return data.user;
}

export async function listGroups(userId) {
  await requireUser(userId);
  const { data, error } = await supabase
    .from("groups")
    .select("id, owner_id, name, description, visibility, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listMyGroupMemberships(userId) {
  const user = await requireUser(userId);
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, user_id, role, status")
    .eq("user_id", user.id);
  if (error) throw error;
  return data || [];
}

export async function createGroup(userId, values) {
  const user = await requireUser(userId);
  const payload = validateGroup(values);
  const { data, error } = await supabase
    .from("groups")
    .insert({ ...payload, owner_id: user.id })
    .select("id, owner_id, name, description, visibility, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function joinPublicGroup(userId, groupId) {
  const user = await requireUser(userId);
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, visibility")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) throw new Error("This group is unavailable.");
  if (group.visibility !== "public") {
    throw new Error("Only public groups can be joined from this page.");
  }

  async function findMembership() {
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, user_id, role, status")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const existing = await findMembership();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "member", status: "active" })
    .select("group_id, user_id, role, status")
    .single();
  if (!error) return data;
  if (error.code === "23505") {
    const racedMembership = await findMembership();
    if (racedMembership) return racedMembership;
  }
  throw error;
}
