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
  const status = String(verified.status ?? '').toLowerCase();
  if (!['successful', 'failed', 'reversed', 'refunded'].includes(status)) return { ok: false, reason: 'unknown_status' };
  if (String(verified.tx_ref ?? '') !== expected.providerReference) return { ok: false, reason: 'reference_mismatch' };
  if (!/^\d+$/.test(String(verified.id ?? ''))) return { ok: false, reason: 'transaction_id_mismatch' };
  if (expected.providerTransactionId != null
      && String(verified.id) !== String(expected.providerTransactionId)) return { ok: false, reason: 'transaction_id_mismatch' };
  if (String(verified.currency ?? '').toUpperCase() !== String(expected.currency ?? '').toUpperCase()) {
    return { ok: false, reason: 'currency_mismatch' };
  }

  const expectedAmount = amountInMinorUnits(expected.amount);
  const verifiedAmount = amountInMinorUnits(verified.amount);
  if (expectedAmount === null || verifiedAmount !== expectedAmount) return { ok: false, reason: 'amount_mismatch' };

  const expectedEmail = String(expected.email ?? '').trim().toLowerCase();
  const verifiedEmail = String(verified.customer?.email ?? '').trim().toLowerCase();
  if (!expectedEmail || !verifiedEmail || verifiedEmail !== expectedEmail) return { ok: false, reason: 'customer_mismatch' };
  return { ok: true, reason: null, status };
}

const completedRefundStatuses = new Set([
  'completed', 'completed-bank-transfer', 'completed-momo',
  'completed-mpgs', 'completed-offline', 'completed-preauth', 'successful'
]);

export function isFullFlutterwaveRefund(refunds, expected) {
  if (!Array.isArray(refunds) || !expected) return false;
  const transactionId = String(expected.providerTransactionId ?? '');
  const completedAmount = refunds.reduce((total, refund) => {
    if (String(refund.transaction_id ?? refund.tx_id ?? '') !== transactionId
        || !completedRefundStatuses.has(String(refund.status ?? '').toLowerCase())) return total;
    const amount = Number(refund.amount_refunded);
    return Number.isFinite(amount) && amount > 0 ? total + amount : total;
  }, 0);
  const expectedAmount = Number(expected.amount);
  return Number.isFinite(expectedAmount) && expectedAmount > 0
    && completedAmount >= expectedAmount - 0.000001;
}
