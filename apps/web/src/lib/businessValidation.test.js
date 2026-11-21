import assert from "node:assert/strict";
import test from "node:test";
import { validateBusiness, validateProduct, validateService } from "./businessValidation.js";

test("normalizes business profile fields and accepts secure website links", () => {
  assert.deepEqual(validateBusiness({ name: "  Kora Studio ", country_code: "ng", website_url: "https://kora.example", description: " Objects " }), {
    name: "Kora Studio", description: "Objects", website_url: "https://kora.example/", country_code: "NG"
  });
});

test("rejects empty business names and insecure business URLs", () => {
  assert.throws(() => validateBusiness({ name: " " }), /Business name is required/);
  assert.throws(() => validateBusiness({ name: "Studio", website_url: "http://example.com" }), /HTTPS URL/);
  assert.throws(() => validateBusiness({ name: "Studio", country_code: "NGA" }), /2 characters|two letters/);
});

test("validates and normalizes product price, currency, and HTTPS links", () => {
  assert.deepEqual(validateProduct({ title: " Candle ", price: "12.50", currency: "usd", product_url: "https://shop.example/item" }), {
    title: "Candle", description: null, price: 12.5, currency: "USD", category: null, product_url: "https://shop.example/item"
  });
  assert.throws(() => validateProduct({ title: "Item", price: "0", currency: "USD" }), /positive amount/);
  assert.throws(() => validateProduct({ title: "Item", price: "4", currency: "US" }), /three-letter currency/);
  assert.throws(() => validateProduct({ title: "Item", product_url: "javascript:alert(1)" }), /HTTPS URL/);
});

test("validates service links and required service names", () => {
  assert.equal(validateService({ title: "Consulting", portfolio_url: "https://work.example" }).portfolio_url, "https://work.example/");
  assert.throws(() => validateService({ title: "" }), /Service name is required/);
  assert.throws(() => validateService({ title: "Consulting", contact_url: "//evil.example" }), /HTTPS URL/);
});
