import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthMiddleware, pageSize, readBearerToken, requirePermission, safePage } from './staffAccess.js';

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('parses only a bearer access token', () => {
  assert.equal(readBearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(readBearerToken('Basic abc'), null);
  assert.equal(readBearerToken('Bearer two tokens'), null);
});

test('requires a verified identity and loads permissions from the server lookup', async () => {
  const req = { get: () => 'Bearer signed-token', body: { role: 'super_admin' } };
  const res = response();
  let forwarded = false;
  const middleware = createAuthMiddleware({
    verifyAccessToken: async (token) => ({ id: token === 'signed-token' ? 'user-1' : null }),
    loadAccess: async (userId) => ({ role: userId === 'user-1' ? 'support' : 'user', permissions: ['support.read'] })
  });
  await middleware(req, res, () => { forwarded = true; });
  assert.equal(forwarded, true);
  assert.deepEqual(req.staffIdentity, { userId: 'user-1', role: 'support', permissions: ['support.read'] });
  assert.notEqual(req.staffIdentity.role, req.body.role);
});

test('denies invalid tokens and fails closed when role lookup is unavailable', async () => {
  const invalid = response();
  await createAuthMiddleware({ verifyAccessToken: async () => { const error = new Error(); error.code = 'INVALID_ACCESS_TOKEN'; throw error; }, loadAccess: async () => ({}) })({ get: () => 'Bearer bad' }, invalid, () => assert.fail('must not continue'));
  assert.equal(invalid.statusCode, 401);
  const unavailable = response();
  await createAuthMiddleware({ verifyAccessToken: async () => ({ id: 'u1' }), loadAccess: async () => { throw new Error('database unavailable'); } })({ get: () => 'Bearer good' }, unavailable, () => assert.fail('must not continue'));
  assert.equal(unavailable.statusCode, 503);
});

test('permission guard denies ordinary users and missing staff identity', () => {
  const guard = requirePermission('reports.read');
  const denied = response();
  guard({ staffIdentity: { role: 'user', permissions: [] } }, denied, () => assert.fail('must deny'));
  assert.equal(denied.statusCode, 403);
  const allowed = response();
  let forwarded = false;
  guard({ staffIdentity: { role: 'moderator', permissions: ['reports.read'] } }, allowed, () => { forwarded = true; });
  assert.equal(forwarded, true);
});

test('bounds pagination values', () => {
  assert.equal(safePage('-1'), 0);
  assert.equal(safePage('12'), 12);
  assert.equal(safePage('999999999'), 10000);
  assert.equal(pageSize('0'), 25);
  assert.equal(pageSize('500'), 100);
});
