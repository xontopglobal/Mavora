export function validateGroup(values = {}) {
  const name = String(values.name || "").trim();
  const description = String(values.description || "").trim();
  const visibility = String(values.visibility || "public");

  if (name.length < 2 || name.length > 80) {
    throw new Error("Group name must be between 2 and 80 characters.");
  }
  if (description.length > 500) {
    throw new Error("Group description must be 500 characters or fewer.");
  }
  if (!["public", "private", "hidden"].includes(visibility)) {
    throw new Error("Choose a supported group visibility.");
  }
  return { name, description: description || null, visibility };
}