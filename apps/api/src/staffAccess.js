const BEARER_PATTERN = /^Bearer ([^\s]+)$/i;

export function readBearerToken(header) {
  const match = typeof header === 'string' ? header.match(BEARER_PATTERN) : null;
  return match?.[1] || null;
}

export function createAuthMiddleware({ verifyAccessToken, loadAccess }) {
  return async function authenticateStaffRequest(req, res, next) {
    const token = readBearerToken(req.get('authorization'));
    if (!token) return res.status(401).json({ error: 'Sign in is required.' });

    try {
      const user = await verifyAccessToken(token);
      if (!user?.id) return res.status(401).json({ error: 'The access token is invalid.' });
      const access = await loadAccess(user.id);
      req.staffIdentity = { userId: user.id, role: access.role, permissions: access.permissions };
      return next();
    } catch (error) {
      if (error?.code === 'INVALID_ACCESS_TOKEN') return res.status(401).json({ error: 'The access token is invalid or expired.' });
      return res.status(503).json({ error: 'Staff authorization is temporarily unavailable.' });
    }
  };
}

export function requirePermission(permission) {
  return function permissionGuard(req, res, next) {
    if (!req.staffIdentity?.permissions?.includes(permission)) {
      return res.status(403).json({ error: 'You do not have permission to access this staff service.' });
    }
    return next();
  };
}

export function safePage(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, 10000) : fallback;
}

export function pageSize(value, fallback = 25) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}
