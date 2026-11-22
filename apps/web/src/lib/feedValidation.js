export function validatePostBody(value) {
  const body = String(value || "").trim();
  if (!body) throw new Error("Write something before sharing.");
  if (body.length > 5000) throw new Error("Posts must be 5,000 characters or fewer.");
  return body;
}