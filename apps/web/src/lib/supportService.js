import { supabase } from "./supabase.js";
import { validateSupportReply, validateSupportTicket } from "./supportValidation.js";

function unwrap(response) {
  if (response?.error) throw response.error;
  return response?.data;
}

export function createSupportService(client = supabase) {
  async function requireUser(expectedUserId) {
    if (!client) throw new Error("Supabase is not configured.");
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Sign in to contact Ofsocio support.");
    if (expectedUserId && data.user.id !== expectedUserId) throw new Error("Your account session changed. Please refresh and try again.");
    return data.user;
  }

  async function listTickets(expectedUserId) {
    await requireUser(expectedUserId);
    return unwrap(await client.from("support_tickets")
      .select("id, requester_id, subject, category, description, status, assigned_to, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100)) || [];
  }

  async function listTicketMessages(expectedUserId, ticketId) {
    await requireUser(expectedUserId);
    if (!ticketId) return [];
    return unwrap(await client.from("support_ticket_messages")
      .select("id, ticket_id, sender_id, sender_kind, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(300)) || [];
  }

  async function createTicket(expectedUserId, values) {
    const user = await requireUser(expectedUserId);
    return unwrap(await client.from("support_tickets")
      .insert({ ...validateSupportTicket(values), requester_id: user.id })
      .select("id, requester_id, subject, category, description, status, assigned_to, created_at, updated_at")
      .single());
  }

  async function sendCustomerMessage(expectedUserId, ticketId, value) {
    const user = await requireUser(expectedUserId);
    if (!ticketId) throw new Error("Choose a support request first.");
    return unwrap(await client.from("support_ticket_messages")
      .insert({ ticket_id: ticketId, sender_id: user.id, body: validateSupportReply(value) })
      .select("id, ticket_id, sender_id, sender_kind, body, created_at")
      .single());
  }

  async function replyAsStaff(expectedUserId, ticketId, value) {
    await requireUser(expectedUserId);
    if (!ticketId) throw new Error("Choose a support request first.");
    return unwrap(await client.rpc("reply_to_support_ticket", { p_ticket_id: ticketId, p_body: validateSupportReply(value) }));
  }

  async function setTicketStatus(expectedUserId, ticketId, status) {
    await requireUser(expectedUserId);
    if (!ticketId || !["in_progress", "escalated", "resolved", "closed"].includes(status)) {
      throw new Error("Choose a supported support request status.");
    }
    return unwrap(await client.rpc("set_support_ticket_status", { p_ticket_id: ticketId, p_status: status }));
  }

  return { listTickets, listTicketMessages, createTicket, sendCustomerMessage, replyAsStaff, setTicketStatus };
}

const supportService = createSupportService();
export const listSupportTickets = (...args) => supportService.listTickets(...args);
export const listSupportTicketMessages = (...args) => supportService.listTicketMessages(...args);
export const createSupportTicket = (...args) => supportService.createTicket(...args);
export const sendSupportMessage = (...args) => supportService.sendCustomerMessage(...args);
export const replyToSupportTicket = (...args) => supportService.replyAsStaff(...args);
export const setSupportTicketStatus = (...args) => supportService.setTicketStatus(...args);
