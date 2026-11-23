import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStaffData } from './staffData.js';

test('verifies identity through Auth and resolves grants from protected role tables', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'verified-user', user_metadata: { role: 'super_admin' } }), { status: 200 });
    if (url.includes('/user_roles?')) return new Response(JSON.stringify([{ role: 'support' }]), { status: 200 });
    return new Response(JSON.stringify([{ permission: 'support.read' }]), { status: 200 });
  };
  const data = createSupabaseStaffData({ url: 'https://example.supabase.co/', anonKey: 'public-key', serviceRoleKey: 'server-key', fetchImpl });
  assert.deepEqual(await data.verifyAccessToken('signed-token'), { id: 'verified-user' });
  assert.deepEqual(await data.loadAccess('verified-user'), { role: 'support', permissions: ['support.read'] });
  assert.equal(calls[0].options.headers.apikey, 'public-key');
  assert.equal(calls[0].options.headers.authorization, 'Bearer signed-token');
  assert.equal(calls[1].options.headers.apikey, 'server-key');
  assert.equal(calls[1].options.headers.authorization, 'Bearer server-key');
  assert.equal(calls[1].url.includes('user_metadata'), false);
});

test('rejects invalid tokens and fails closed if required server configuration is absent', async () => {
  const invalid = createSupabaseStaffData({
    url: 'https://example.supabase.co', anonKey: 'public-key', serviceRoleKey: 'server-key',
    fetchImpl: async () => new Response('{}', { status: 401 })
  });
  await assert.rejects(invalid.verifyAccessToken('expired'), { code: 'INVALID_ACCESS_TOKEN' });
  const missing = createSupabaseStaffData({ url: '', anonKey: '', serviceRoleKey: '' });
  assert.equal(missing.configured, false);
  await assert.rejects(missing.loadAccess('user-id'), /not configured/);
});

test('returns only approved fields from read queues with bounded filters', async () => {
  const calls = [];
  const data = createSupabaseStaffData({
    url: 'https://example.supabase.co', anonKey: 'public-key', serviceRoleKey: 'server-key',
    fetchImpl: async (url) => { calls.push(url); return new Response('[]', { status: 200 }); }
  });
  await data.listReports({ offset: 25, limit: 100, status: 'open' });
  await data.listVerificationApplications({ offset: 0, limit: 25, status: 'submitted' });
  await data.listAuditEvents({ offset: 0, limit: 25 });
  assert.match(calls[0], /select=id%2Creporter_id%2Ctarget_type%2Ctarget_id%2Creason%2Cdescription%2Cstatus%2Ccreated_at/);
  assert.match(calls[0], /limit=100/);
  assert.match(calls[1], /select=id%2Capplicant_id%2Capplication_type%2Cstatus%2Creason_category%2Csubmitted_at%2Cupdated_at/);
  assert.match(calls[2], /select=id%2Cactor_id%2Caction%2Ctarget_type%2Ctarget_id%2Creason_category%2Cmetadata%2Ccreated_at/);
});
