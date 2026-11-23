const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "hate_or_discrimination",
  "violence_or_threats",
  "impersonation",
  "other"
]);

export function validateReport({ targetType, targetId, reason, description }) {
  if (!new Set(["post", "account", "business", "product", "service", "reel", "story"]).has(targetType)) {
    throw new Error("This content type cannot be reported here.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(targetId || ""))) {
    throw new Error("This item is unavailable.");
  }
  if (!REPORT_REASONS.has(reason)) throw new Error("Choose a reason for your report.");
  const cleanDescription = typeof description === "string" ? description.trim() : "";
  if (cleanDescription.length < 10 || cleanDescription.length > 2000) {
    throw new Error("Add a description between 10 and 2,000 characters.");
  }
  return { target_type: targetType, target_id: targetId, reason, description: cleanDescription };
}
