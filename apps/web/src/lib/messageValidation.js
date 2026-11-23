export function validateMessageBody(value) {
  if (typeof value !== "string") throw new Error("Write a message before sending.");
  const body = value.trim();
  if (!body) throw new Error("Write a message before sending.");
  if (body.length > 5000) throw new Error("Messages must be 5,000 characters or fewer.");
  return body;
}

export function validateConversationParticipant(userId, otherUserId) {
  if (typeof otherUserId !== "string" || !otherUserId.trim()) {
    throw new Error("Choose an Ofsocio member to message.");
  }
  if (otherUserId === userId) throw new Error("You cannot start a conversation with yourself.");
  return otherUserId;
}
