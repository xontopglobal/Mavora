export function normalizeCountryRegionCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (code && !/^[A-Z]{2}$/.test(code)) {
    throw new Error("Country / region must use a two-letter ISO code, such as NG or GB.");
  }
  return code || null;
}
