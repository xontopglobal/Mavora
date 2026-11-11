import { timingSafeEqual } from 'node:crypto';

export function parseBearerToken(value) {
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+([A-Za-z0-9._~-]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function constantTimeEqual(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length === 0 || expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function amountInMinorUnits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minorUnits = Math.round(amount * 100);
  if (!Number.isSafeInteger(minorUnits) || Math.abs(amount * 100 - minorUnits) > 0.000001) return null;
  return minorUnits;
}

export function validateFlutterwaveReceipt(expected, verified) {
  if (!expected || !verified) return { ok: false, reason: 'missing_transaction' };
  if (verified.status !== 'successful') return { ok: false, reason: 'not_successful' };
  if (String(verified.tx_ref ?? '') !== expected.providerReference) return { ok: false, reason: 'reference_mismatch' };
  if (String(verified.id ?? '') !== String(expected.providerTransactionId ?? '')) return { ok: false, reason: 'transaction_id_mismatch' };
  if (String(verified.currency ?? '').toUpperCase() !== String(expected.currency ?? '').toUpperCase()) {
    return { ok: false, reason: 'currency_mismatch' };
  }

  const expectedAmount = amountInMinorUnits(expected.amount);
  const verifiedAmount = amountInMinorUnits(verified.amount);
  if (expectedAmount === null || verifiedAmount !== expectedAmount) return { ok: false, reason: 'amount_mismatch' };

  const expectedEmail = String(expected.email ?? '').trim().toLowerCase();
  const verifiedEmail = String(verified.customer?.email ?? '').trim().toLowerCase();
  if (!expectedEmail || !verifiedEmail || verifiedEmail !== expectedEmail) return { ok: false, reason: 'customer_mismatch' };
  return { ok: true, reason: null };
}