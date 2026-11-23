const STORY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function extensionFor(type) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm"
  })[type] || "";
}

function validateFile(file, supportedTypes, maximumBytes, label) {
  if (!file || typeof file !== "object" || !supportedTypes.has(file.type)) {
    throw new Error(`Choose a supported ${label} file.`);
  }
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > maximumBytes) {
    throw new Error(`${label} files must be at most ${Math.floor(maximumBytes / (1024 * 1024))} MB.`);
  }
  return extensionFor(file.type);
}

async function hasSupportedSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (file.type === "image/webp") return text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
  if (file.type === "video/mp4") return text(4, 8) === "ftyp";
  if (file.type === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

async function validateMedia(file, supportedTypes, maximumBytes, label) {
  const extension = validateFile(file, supportedTypes, maximumBytes, label);
  if (typeof file.slice !== "function" || !await hasSupportedSignature(file)) {
    throw new Error(`The ${label} file contents do not match the selected format.`);
  }
  return extension;
}

export async function validateStoryFile(file) {
  const types = VIDEO_TYPES.has(file?.type) ? VIDEO_TYPES : STORY_IMAGE_TYPES;
  return { extension: await validateMedia(file, types, types === VIDEO_TYPES ? 50 * 1024 * 1024 : 10 * 1024 * 1024, "story media"), mediaType: types === VIDEO_TYPES ? "video" : "image" };
}

export async function validateReelFile(file) {
  return validateMedia(file, VIDEO_TYPES, 100 * 1024 * 1024, "reel video");
}
