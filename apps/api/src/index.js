import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const origins = (process.env.CLIENT_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
app.use(helmet());
app.use(cors({ origin(origin, callback) {
  if (!origin || origins.length === 0 || origins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
}}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'Mavora API', version: '0.2.0' }));
app.get('/api/status', (_req, res) => res.json({ name: 'Mavora', modules: ['auth-foundation','social-shell','groups-shell','messages-shell','marketplace-shell'] }));

// Webhook foundation only. Verify the provider signature and then fetch the
// transaction from Flutterwave server-to-server before any entitlement update.
// Persist provider event IDs/references with a unique constraint for idempotency.
app.post('/api/webhooks/flutterwave', (req, res) => {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  const supplied = req.headers['verif-hash'];
  if (!expected || !supplied || supplied !== expected) {
    return res.status(401).json({ received: false, error: 'Webhook authentication failed' });
  }
  return res.status(202).json({ received: true, processed: false, note: 'Transaction verification and idempotent processing are not implemented yet' });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Mavora API listening on ${port}`));
