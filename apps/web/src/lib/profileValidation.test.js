import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCountryRegionCode } from "./profileValidation.js";

test("normalizes an ISO alpha-2 country or region code", () => {
  assert.equal(normalizeCountryRegionCode(" ng "), "NG");
  assert.equal(normalizeCountryRegionCode(""), null);
});

test("rejects dialing prefixes and non-ISO length values", () => {
  assert.throws(() => normalizeCountryRegionCode("+234"), /two-letter ISO/);
  assert.throws(() => normalizeCountryRegionCode("NGA"), /two-letter ISO/);
});
