const CATEGORIES = new Set(["account", "privacy", "business", "payments", "safety", "technical", "other"]);

export function validateSupportTicket(values = {}) {
  const subject = typeof values.subject === "string" ? values.subject.trim() : "";
  const description = typeof values.description === "string" ? values.description.trim() : "";
  const category = values.category;
  if (subject.length < 3 || subject.length > 120) throw new Error("The subject must be between 3 and 120 characters.");
  if (!CATEGORIES.has(category)) throw new Error("Choose a support category.");
  if (description.length < 10 || description.length > 5000) throw new Error("Describe the issue in 10 to 5,000 characters.");
  return { subject, category, description };
}

export function validateSupportReply(value) {
  const body = typeof value === "string" ? value.trim() : "";
  if (!body || body.length > 5000) throw new Error("Replies must be between 1 and 5,000 characters.");
  return body;
}
