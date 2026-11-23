import { supabase } from "./supabase.js";
import { validateReport } from "./reportValidation.js";

export async function reportContent(expectedUserId, targetType, targetId, reason, description = "") {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in to report content.");
  if (expectedUserId && authData.user.id !== expectedUserId) {
    throw new Error("Your account session changed. Please refresh and try again.");
  }
  const report = validateReport({ targetType, targetId, reason, description });
  const { data, error } = await supabase.from("content_reports")
    .insert({ ...report, reporter_id: authData.user.id })
    .select("id, created_at")
    .single();
  if (error?.code === "23505") throw new Error("You already have an active report for this item. The moderation team will review it.");
  if (error) throw error;
  if (!data?.id) throw new Error("The report was not confirmed by Ofsocio.");
  return data;
}
