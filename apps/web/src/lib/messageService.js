import { supabase } from "./supabase.js";
import { validateConversationParticipant, validateMessageBody } from "./messageValidation.js";

function unwrap(response) {
  if (response?.error) throw response.error;
  return response?.data;
}

export function createMessageService(client = supabase) {
  async function requireUser(expectedUserId) {
    if (!client) throw new Error("Supabase is not configured.");
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Sign in to use Messages.");
    if (expectedUserId && data.user.id !== expectedUserId) {
      throw new Error("Your account session changed. Please refresh and try again.");
    }
    return data.user;
  }

  async function listConversations(expectedUserId) {
    await requireUser(expectedUserId);
    return unwrap(await client.rpc("get_my_conversations")) || [];
  }

  async function startOrOpenConversation(expectedUserId, otherUserId) {
    const user = await requireUser(expectedUserId);
    validateConversationParticipant(user.id, otherUserId);
    const id = unwrap(await client.rpc("create_or_get_conversation", { p_other_user_id: otherUserId }));
    if (typeof id !== "string" || !id) throw new Error("Ofsocio did not confirm the conversation.");
    return id;
  }

  async function listMessages(expectedUserId, conversationId) {
    await requireUser(expectedUserId);
    if (typeof conversationId !== "string" || !conversationId) return [];
    return unwrap(await client.from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200)) || [];
  }

  async function sendMessage(expectedUserId, conversationId, value) {
    const user = await requireUser(expectedUserId);
    if (typeof conversationId !== "string" || !conversationId) {
      throw new Error("Choose a conversation before sending a message.");
    }
    const body = validateMessageBody(value);
    return unwrap(await client.from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body })
      .select("id, conversation_id, sender_id, body, created_at")
      .single());
  }

  return { listConversations, startOrOpenConversation, listMessages, sendMessage };
}

const messageService = createMessageService();
export const listConversations = (...args) => messageService.listConversations(...args);
export const startOrOpenConversation = (...args) => messageService.startOrOpenConversation(...args);
export const listMessages = (...args) => messageService.listMessages(...args);
export const sendMessage = (...args) => messageService.sendMessage(...args);
