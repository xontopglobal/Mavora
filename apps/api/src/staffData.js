const REST_TABLES = new Set(['user_roles', 'role_permissions', 'content_reports', 'kyc_applications', 'audit_logs']);

export function createSupabaseStaffData({ url, anonKey, serviceRoleKey, fetchImpl = fetch }) {
  const root = url?.replace(/\/$/, '');
  const configured = Boolean(root && anonKey && serviceRoleKey);

  async function request(path, { method = 'GET', body, prefer } = {}) {
    if (!configured) throw new Error('Staff services are not configured.');
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(prefer ? { prefer } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.msg || 'The staff data service failed.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function verifyAccessToken(token) {
    if (!configured) throw new Error('Staff services are not configured.');
    const response = await fetchImpl(`${root}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` }
    });
    if (response.status === 401 || response.status === 403) {
      const error = new Error('Invalid access token.');
      error.code = 'INVALID_ACCESS_TOKEN';
      throw error;
    }
    if (!response.ok) throw new Error('Authentication service unavailable.');
    const user = await response.json();
    return typeof user?.id === 'string' ? { id: user.id } : null;
  }

  function tablePath(table, query) {
    if (!REST_TABLES.has(table)) throw new Error('Unsupported staff data table.');
    return `/rest/v1/${table}?${new URLSearchParams(query)}`;
  }

  async function loadAccess(userId) {
    const roles = await request(tablePath('user_roles', {
      select: 'role', user_id: `eq.${userId}`, limit: '1'
    }));
    const role = roles?.[0]?.role;
    if (!role || role === 'user') return { role: role || 'user', permissions: [] };
    const grants = await request(tablePath('role_permissions', {
      select: 'permission', role: `eq.${role}`
    }));
    return { role, permissions: [...new Set((grants || []).map((grant) => grant.permission).filter((value) => typeof value === 'string'))] };
  }

  async function listReports({ offset, limit, status }) {
    const query = {
      select: 'id,reporter_id,target_type,target_id,reason,description,status,created_at',
      order: 'created_at.desc,id.desc',
      offset: String(offset), limit: String(limit)
    };
    if (status) query.status = `eq.${status}`;
    return request(tablePath('content_reports', query));
  }

  async function listVerificationApplications({ offset, limit, status }) {
    const query = {
      select: 'id,applicant_id,application_type,status,reason_category,submitted_at,updated_at',
      order: 'submitted_at.asc,id.asc', offset: String(offset), limit: String(limit)
    };
    if (status) query.status = `eq.${status}`;
    return request(tablePath('kyc_applications', query));
  }

  async function listAuditEvents({ offset, limit }) {
    return request(tablePath('audit_logs', {
      select: 'id,actor_id,action,target_type,target_id,reason_category,metadata,created_at',
      order: 'created_at.desc,id.desc', offset: String(offset), limit: String(limit)
    }));
  }

  return { configured, verifyAccessToken, loadAccess, listReports, listVerificationApplications, listAuditEvents };
}
