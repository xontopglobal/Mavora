import React, { useCallback, useEffect, useState } from 'react';

const roleOptions = ['user', 'moderator', 'support', 'admin', 'super_admin'];
const pretty = value => String(value || '').replaceAll('_', ' ');
const formatDate = value => value ? new Date(value).toLocaleDateString() : '—';

export default function StaffAdminDashboard({ supabase, currentUser, role = 'admin', onNotice }) {
  const [section, setSection] = useState('Overview');
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [auditRows, setAuditRows] = useState([]);
  const [reports, setReports] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [status, setStatus] = useState('Loading secure admin workspace…');
  const isSuperAdmin = role === 'super_admin';

  const loadSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_dashboard_summary');
    if (error) throw error;
    setSummary(data || {});
  }, [supabase]);

  const loadMembers = useCallback(async (search = appliedSearch) => {
    const { data, error } = await supabase.rpc('admin_list_members', {
      p_search: search.trim() || null,
      p_limit: 50,
      p_offset: 0
    });
    if (error) throw error;
    setMembers(data || []);
  }, [supabase, appliedSearch]);

  const loadReports = useCallback(async () => {
    const { data, error } = await supabase.from('content_reports').select('id,reporter_id,target_type,target_id,reason,status,created_at').in('status', ['open','reviewing']).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    setReports(data || []);
  }, [supabase]);

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_staff_audit', { p_limit: 50 });
    if (error) throw error;
    setAuditRows(data || []);
  }, [supabase]);

  const refresh = useCallback(async () => {
    setStatus('Refreshing admin workspace…');
    try {
      await Promise.all([loadSummary(), loadMembers(), loadAudit(), loadReports()]);
      setStatus('Admin workspace connected. Member and role changes are checked and audited by Supabase.');
    } catch (error) {
      setStatus(`Admin data could not load: ${error.message}. Confirm migration 009 is applied and your account has an admin role.`);
    }
  }, [loadSummary, loadMembers, loadAudit, loadReports]);

  useEffect(() => { refresh(); }, [refresh]);

  async function searchMembers(event) {
    event.preventDefault();
    setAppliedSearch(memberSearch.trim());
    setStatus('Searching members…');
    try {
      await loadMembers(memberSearch.trim());
      setStatus('Member search complete.');
    } catch (error) {
      setStatus(`Member search failed: ${error.message}`);
    }
  }

  async function reviewReport(report, nextStatus) {
    setBusyId(report.id);
    setStatus('Saving content report decision…');
    try {
      const { error } = await supabase.rpc('admin_dashboard_review_report', { p_report_id: report.id, p_status: nextStatus, p_reason_category: 'admin_dashboard_review' });
      if (error) throw error;
      setStatus(`Report marked ${pretty(nextStatus)} and audited.`);
      await Promise.all([loadReports(), loadSummary(), loadAudit()]);
    } catch (error) { setStatus(`Report review failed: ${error.message}`); }
    finally { setBusyId(''); }
  }

  async function changeRole(member, nextRole) {
    if (nextRole === member.role) return;
    const isElevated = ['admin', 'super_admin'].includes(nextRole);
    if (isElevated && !isSuperAdmin) {
      setStatus('Only a super administrator can grant admin or super-admin roles.');
      return;
    }
    if (member.member_id === currentUser?.id) {
      setStatus('You cannot change your own staff role from this panel.');
      return;
    }
    const prompt = `Change ${member.display_name || member.username || member.email || member.member_id} from ${pretty(member.role)} to ${pretty(nextRole)}? This action will be recorded in the staff audit log.`;
    if (!window.confirm(prompt)) return;
    setBusyId(member.member_id);
    setStatus('Saving role change…');
    try {
      const { error } = await supabase.rpc('admin_set_member_role', {
        p_user_id: member.member_id,
        p_role: nextRole,
        p_reason: 'Changed from Ofsocio Admin Dashboard'
      });
      if (error) throw error;
      setStatus(`Member role updated to ${pretty(nextRole)} and recorded in the audit log.`);
      await Promise.all([loadMembers(), loadAudit(), loadSummary()]);
      onNotice?.('Member role updated and audited.');
    } catch (error) {
      setStatus(`Role change failed: ${error.message}`);
    } finally {
      setBusyId('');
    }
  }

  const metrics = [
    ['Members', summary?.members_total],
    ['Posts', summary?.posts_total],
    ['Open reports', summary?.reports_open],
    ['Support queue', summary?.tickets_open],
    ['Premium active', summary?.premium_active],
    ['Pending ads', summary?.ads_pending]
  ];

  return <section className="staff-admin-dashboard">
    <div className="view-heading staff-admin-heading">
      <div><div className="eyebrow">OFSOCIO · SECURE STAFF WORKSPACE</div><h1>Admin Dashboard</h1><p>Member operations, staff access and platform oversight.</p></div>
      <button type="button" className="button outline small-button" onClick={refresh}>Refresh data</button>
    </div>

    <div className="live-profile-tabs staff-admin-tabs" role="tablist" aria-label="Admin sections">
      {['Overview', 'Members & roles', 'Content reports', 'Audit log'].map(item => <button type="button" role="tab" aria-selected={section === item} key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}>{item}</button>)}
    </div>

    {section === 'Overview' && <>
      <div className="staff-admin-metrics">{metrics.map(([label, value]) => <article className="panel staff-admin-metric" key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></article>)}</div>
      <section className="panel staff-admin-info"><h2>Operations overview</h2><p>Use the Members & roles section to search accounts and manage staff roles. Customer-service agents handle member tickets from the Customer Service workspace. Every privileged role change is checked server-side and written to the audit log.</p><p className="staff-admin-security-note">Account suspension, deletion and payment overrides are intentionally not exposed as client-side actions. Those require separate server-side controls and verification.</p></section>
    </>}

    {section === 'Members & roles' && <section className="panel staff-admin-members">
      <div className="staff-admin-section-head"><div><h2>Member directory</h2><p>Search registered members and manage their access role.</p></div><span className="staff-admin-count">{members.length} shown</span></div>
      <form className="staff-admin-search" onSubmit={searchMembers}><input value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Search by name, username or email" aria-label="Search members"/><button className="button primary" type="submit">Search</button></form>
      {members.length ? <div className="staff-admin-member-list">{members.map(member => <article className="staff-admin-member" key={member.member_id}>
        <div className="staff-admin-member-details"><strong>{member.display_name || member.username || 'Ofsocio member'}</strong><span>{member.username ? `@${member.username} · ` : ''}{member.email || member.member_id}</span><small>Joined {formatDate(member.created_at)} · Current role: {pretty(member.role)}</small></div>
        <div className="staff-admin-role-control"><label htmlFor={`staff-role-${member.member_id}`}>Access role</label><select id={`staff-role-${member.member_id}`} value={member.role || 'user'} disabled={busyId === member.member_id || member.member_id === currentUser?.id || (!isSuperAdmin && ['admin','super_admin'].includes(member.role))} onChange={event => changeRole(member, event.target.value)}>{roleOptions.map(option => <option value={option} key={option} disabled={!isSuperAdmin && ['admin','super_admin'].includes(option)}>{pretty(option)}</option>)}</select>{member.member_id === currentUser?.id && <small>Your own role is locked.</small>}</div>
      </article>)}</div> : <div className="empty-state">No members found for this search.</div>}
      <p className="staff-admin-security-note">Role changes are restricted by the database. Only a super administrator can grant admin or super-admin access; you cannot change your own role.</p>
    </section>}

    {section === 'Content reports' && <section className="panel staff-admin-audit"><div className="staff-admin-section-head"><div><h2>Content reports</h2><p>Review member reports and record a decision.</p></div><span className="staff-admin-count">{reports.length} open</span></div>
      {reports.length ? <div className="staff-admin-audit-list">{reports.map(report => <article className="staff-admin-audit-row" key={report.id}><div><strong>{pretty(report.target_type)} · {pretty(report.status)}</strong><span>{report.reason}</span><small>{formatDate(report.created_at)} · Target {report.target_id}</small></div><div className="staff-admin-report-actions"><button type="button" className="button outline small-button" disabled={busyId === report.id} onClick={() => reviewReport(report, 'reviewing')}>Mark reviewing</button><button type="button" className="button outline small-button" disabled={busyId === report.id} onClick={() => reviewReport(report, 'dismissed')}>Dismiss</button><button type="button" className="button primary small-button" disabled={busyId === report.id} onClick={() => reviewReport(report, 'resolved')}>Resolve</button></div></article>)}</div> : <div className="empty-state">No open content reports.</div>}
    </section>}

    {section === 'Audit log' && <section className="panel staff-admin-audit"><div className="staff-admin-section-head"><div><h2>Staff audit log</h2><p>Recent privileged actions recorded by the database.</p></div><button type="button" className="button outline small-button" onClick={loadAudit}>Reload</button></div>
      {auditRows.length ? <div className="staff-admin-audit-list">{auditRows.map(row => <article className="staff-admin-audit-row" key={row.id}><div><strong>{pretty(row.action)}</strong><span>{pretty(row.actor_role)} · {row.actor_id}</span><small>{formatDate(row.created_at)} · {row.entity_type}{row.entity_id ? ` · ${row.entity_id}` : ''}</small></div><details><summary>Details</summary><pre>{JSON.stringify(row.details || {}, null, 2)}</pre></details></article>)}</div> : <div className="empty-state">No staff audit entries yet.</div>}
    </section>}

    <p className="staff-admin-status" role="status" aria-live="polite">{status}</p>
  </section>;
}
