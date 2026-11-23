export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const AVATAR_TYPES = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

export function avatarExtension(file) {
  if (!file || typeof file.type !== "string" || typeof file.size !== "number") {
    throw new Error("Choose an image file to upload.");
  }

  const extension = AVATAR_TYPES[file.type];
  if (!extension) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  return extension;
}
