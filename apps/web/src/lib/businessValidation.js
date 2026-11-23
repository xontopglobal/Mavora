function cleanText(value, label, maxLength, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return result || null;
}

function cleanHttpsUrl(value, label) {
  const result = cleanText(value, label, 2048);
  if (!result) return null;
  let parsed;
  try { parsed = new URL(result); } catch { throw new Error(`${label} must be a valid HTTPS URL.`); }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  return parsed.toString();
}

export function validateBusiness(values) {
  const countryCode = cleanText(values.country_code, "Country code", 2);
  if (countryCode && !/^[a-z]{2}$/i.test(countryCode)) throw new Error("Country code must use two letters.");
  return {
    name: cleanText(values.name, "Business name", 80, true),
    description: cleanText(values.description, "Description", 1000),
    website_url: cleanHttpsUrl(values.website_url, "Website"),
    country_code: countryCode?.toUpperCase() || null
  };
}

export function validateProduct(values) {
  const priceText = typeof values.price === "string" ? values.price.trim() : "";
  const price = priceText ? Number(priceText) : null;
  if (price !== null && (!Number.isFinite(price) || price <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(priceText))) {
    throw new Error("Price must be a positive amount with up to two decimal places.");
  }
  const currency = cleanText(values.currency, "Currency", 3);
  if (price !== null && (!currency || !/^[a-z]{3}$/i.test(currency))) {
    throw new Error("Enter a three-letter currency when adding a price.");
  }
  if (currency && !/^[a-z]{3}$/i.test(currency)) throw new Error("Currency must use three letters.");
  return {
    title: cleanText(values.title, "Product name", 120, true),
    description: cleanText(values.description, "Description", 2000),
    price,
    currency: currency?.toUpperCase() || null,
    category: cleanText(values.category, "Category", 80),
    product_url: cleanHttpsUrl(values.product_url, "Product link")
  };
}

export function validateService(values) {
  return {
    title: cleanText(values.title, "Service name", 120, true),
    description: cleanText(values.description, "Description", 2000),
    category: cleanText(values.category, "Category", 80),
    portfolio_url: cleanHttpsUrl(values.portfolio_url, "Portfolio link"),
    contact_url: cleanHttpsUrl(values.contact_url, "Contact link")
  };
}
