import { createAuthMiddleware, pageSize, requirePermission, safePage } from './staffAccess.js';

const REPORT_STATUSES = new Set(['open', 'reviewing', 'resolved', 'dismissed']);
const KYC_STATUSES = new Set(['submitted', 'in_review', 'verified', 'rejected', 'needs_more_information', 'expired', 'suspended']);

function sendStaffError(res) {
  return res.status(503).json({ error: 'The staff service is temporarily unavailable.' });
}

export function registerStaffRoutes(app, data) {
  const authenticate = createAuthMiddleware(data);

  app.get('/api/me/capabilities', authenticate, (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ role: req.staffIdentity.role, capabilities: req.staffIdentity.permissions });
  });

  app.get('/api/admin/reports', authenticate, requirePermission('reports.read'), async (req, res) => {
    const status = typeof req.query.status === 'string' && REPORT_STATUSES.has(req.query.status) ? req.query.status : undefined;
    try {
      const reports = await data.listReports({ offset: safePage(req.query.offset), limit: pageSize(req.query.limit), status });
      res.set('Cache-Control', 'no-store');
      return res.json({ reports });
    } catch { return sendStaffError(res); }
  });

  app.get('/api/admin/kyc', authenticate, requirePermission('kyc.read'), async (req, res) => {
    const status = typeof req.query.status === 'string' && KYC_STATUSES.has(req.query.status) ? req.query.status : undefined;
    try {
      const applications = await data.listVerificationApplications({ offset: safePage(req.query.offset), limit: pageSize(req.query.limit), status });
      res.set('Cache-Control', 'no-store');
      return res.json({ applications });
    } catch { return sendStaffError(res); }
  });

  app.get('/api/admin/audit', authenticate, requirePermission('audit.read'), async (req, res) => {
    try {
      const events = await data.listAuditEvents({ offset: safePage(req.query.offset), limit: pageSize(req.query.limit) });
      res.set('Cache-Control', 'no-store');
      return res.json({ events });
    } catch { return sendStaffError(res); }
  });
}
