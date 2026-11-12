import test from 'node:test';
import assert from 'node:assert/strict';
import { constantTimeEqual, isFullFlutterwaveRefund, parseBearerToken, validateFlutterwaveReceipt } from '../src/security.js';

const expected = {
  providerReference: 'mavora_reference_1',
  providerTransactionId: '998877',
  amount: '2500.00',
  currency: 'NGN',
  email: 'ada@example.test'
};

const verified = {
  id: 998877,
  tx_ref: 'mavora_reference_1',
  status: 'successful',
  amount: 2500,
  currency: 'NGN',
  customer: { email: 'ada@example.test' }
};

test('parses only a single bearer token', () => {
  assert.equal(parseBearerToken('Bearer eyJhbGciOi.test-token_1'), 'eyJhbGciOi.test-token_1');
  assert.equal(parseBearerToken('Basic token'), null);
  assert.equal(parseBearerToken('Bearer token extra'), null);
  assert.equal(parseBearerToken(undefined), null);
});

test('compares webhook secrets and rejects empty or unequal values', () => {
  assert.equal(constantTimeEqual('provider-secret', 'provider-secret'), true);
  assert.equal(constantTimeEqual('provider-secret', 'provider-secrex'), false);
  assert.equal(constantTimeEqual('provider-secret', 'short'), false);
  assert.equal(constantTimeEqual('', ''), false);
});

test('accepts a provider receipt only when all expected fields match', () => {
  assert.deepEqual(validateFlutterwaveReceipt(expected, verified), { ok: true, reason: null, status: 'successful' });
});

test('rejects unsuccessful or mismatched provider receipts', () => {
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, status: 'pending' }).reason, 'unknown_status');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, tx_ref: 'other' }).reason, 'reference_mismatch');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, id: 1 }).reason, 'transaction_id_mismatch');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, amount: 2499 }).reason, 'amount_mismatch');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, amount: 2500.001 }).reason, 'amount_mismatch');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, currency: 'USD' }).reason, 'currency_mismatch');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, customer: { email: 'other@example.test' } }).reason, 'customer_mismatch');
  assert.equal(validateFlutterwaveReceipt(expected, null).reason, 'missing_transaction');
});

test('accepts a verified failure without allowing it to be confused with success', () => {
  const result = validateFlutterwaveReceipt(expected, { ...verified, status: 'failed' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'failed');
  assert.equal(validateFlutterwaveReceipt(expected, { ...verified, status: 'reversed' }).status, 'reversed');
});

test('can verify a transaction by server-generated reference when no webhook ID was supplied', () => {
  const { providerTransactionId: _transactionId, ...byReference } = expected;
  assert.equal(validateFlutterwaveReceipt(byReference, verified).ok, true);
  assert.equal(validateFlutterwaveReceipt(byReference, { ...verified, id: 'not-numeric' }).reason, 'transaction_id_mismatch');
});

test('recognizes only a fully completed refund for the matching original transaction', () => {
  const refunds = [
    { transaction_id: 998877, amount_refunded: 1000, status: 'completed-mpgs' },
    { transaction_id: '998877', amount_refunded: 1500, status: 'completed' },
    { transaction_id: 1, amount_refunded: 2500, status: 'completed' },
    { transaction_id: 998877, amount_refunded: 9000, status: 'processing' }
  ];
  assert.equal(isFullFlutterwaveRefund(refunds, expected), true);
  assert.equal(isFullFlutterwaveRefund(refunds.slice(0, 1), expected), false);
  assert.equal(isFullFlutterwaveRefund(null, expected), false);
});
