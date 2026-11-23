export function validatePostBody(value) {
  const body = String(value || "").trim();
  if (!body) throw new Error("Write something before sharing.");
  if (body.length > 5000) throw new Error("Posts must be 5,000 characters or fewer.");
  return body;
}

export function validateCommentBody(value) {
  const body = String(value || "").trim();
  if (!body) throw new Error("Write a reply before sending it.");
  if (body.length > 2000) throw new Error("Replies must be 2,000 characters or fewer.");
  return body;
}
