import React, { useEffect, useMemo, useState } from "react";
import { createGroup, joinPublicGroup, listGroups, listMyGroupMemberships } from "../lib/groupService";

const emptyGroup = { name: "", description: "", visibility: "public" };

export default function GroupsView({ userId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState(emptyGroup);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [selected, setSelected] = useState(null);
  const [memberships, setMemberships] = useState({});
  const [joiningGroupId, setJoiningGroupId] = useState(null);

  async function refresh() {
    if (!userId) {
      setError("Sign in to browse or create groups.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [groupRows, membershipRows] = await Promise.all([
        listGroups(userId),
        listMyGroupMemberships(userId)
      ]);
      setGroups(groupRows);
      setMemberships(Object.fromEntries(membershipRows.map((membership) => [membership.group_id, membership])));
    } catch (loadError) {
      setError(loadError.message || "Groups could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [userId]);

  const visibleGroups = useMemo(() => groups
    .filter((group) => scope !== "mine" || group.owner_id === userId)
    .filter((group) => `${group.name} ${group.description || ""}`.toLowerCase().includes(query.trim().toLowerCase())),
  [groups, query, scope, userId]);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await createGroup(userId, values);
      setValues(emptyGroup);
      setFormOpen(false);
      setSelected(created);
      setNotice("Your group was created.");
      await refresh();
    } catch (createError) {
      setError(createError.message || "Your group could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function join(group) {
    if (joiningGroupId) return;
    setJoiningGroupId(group.id);
    setError("");
    setNotice("");
    try {
      const membership = await joinPublicGroup(userId, group.id);
      await refresh();
      setNotice(membership.status === "active" ? "You joined the group." : `Membership status: ${membership.status}.`);
    } catch (joinError) {
      setError(joinError.message || "You could not join this group.");
    } finally {
      setJoiningGroupId(null);
    }
  }

  return <>
    <div className="view-heading">
      <div><div className="eyebrow">GATHER AROUND SOMETHING</div><h1>Groups</h1><p>Public groups and your own private spaces, loaded from Ofsocio.</p></div>
      <button className="button primary" type="button" onClick={() => { setFormOpen((open) => !open); setError(""); }} disabled={!userId || saving}>＋ Create a group</button>
    </div>
    {error && <div className="business-feedback error" role="alert">{error} <button type="button" className="text-link" onClick={() => void refresh()}>Retry</button></div>}
    {notice && <div className="business-feedback success" role="status">{notice}</div>}
    {formOpen && <form className="business-editor panel" onSubmit={submit}>
      <div className="business-editor-heading"><div><span className="eyebrow">YOUR COMMUNITY</span><h2>Create a group</h2></div><button type="button" className="quiet-button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button></div>
      <div className="business-form-grid">
        <label className="business-field" htmlFor="group-name"><span>Group name</span><input id="group-name" name="name" value={values.name} onChange={updateField} minLength={2} maxLength={80} required /></label>
        <label className="business-field" htmlFor="group-visibility"><span>Visibility</span><select id="group-visibility" name="visibility" value={values.visibility} onChange={updateField}><option value="public">Public</option><option value="private">Private</option><option value="hidden">Hidden</option></select></label>
        <label className="business-field" htmlFor="group-description"><span>Description</span><textarea id="group-description" name="description" value={values.description} onChange={updateField} maxLength={500} rows="4" /></label>
      </div>
      <div className="business-editor-footer"><span>You will own this group. Only you can manage its profile.</span><button className="button primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create group"}</button></div>
    </form>}
    <div className="filter-row">
      <button type="button" className={`filter ${scope === "all" ? "active" : ""}`} onClick={() => setScope("all")}>For you</button>
      <button type="button" className={`filter ${scope === "mine" ? "active" : ""}`} onClick={() => setScope("mine")}>My groups</button>
      <button type="button" className="filter" disabled title="Nearby group discovery is not connected yet.">Near me</button>
      <label className="quiet-button filter-search">⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups" aria-label="Search groups" /></label>
    </div>
    {loading ? <div className="business-state panel" role="status">Loading groups…</div>
      : visibleGroups.length ? <div className="group-grid">{visibleGroups.map((group, index) => <article className="group-card panel" key={group.id}>
        <div className={`group-image group-cover-${index % 3}`}><span className="group-kind">{group.visibility.toUpperCase()}</span></div>
        <div className="group-content"><div className="eyebrow">{group.owner_id === userId ? "YOUR GROUP" : "OFSOCIO COMMUNITY"}</div><h2>{group.name}</h2><p>{group.description || "No description added."}</p><div className="group-footer"><span className="mini-faces">{group.owner_id === userId ? "OWNER" : memberships[group.id]?.status === "active" ? "JOINED" : memberships[group.id]?.status === "pending" ? "REQUESTED" : "OPEN GROUP"}</span><button className="button outline small-button" type="button" onClick={() => setSelected(group)}>View group</button></div></div>
      </article>)}</div>
      : <div className="business-state panel">{query ? "No groups match your search." : scope === "mine" ? "You have not created a group yet." : "No public groups are available yet. Create one to get started."}</div>}
    {selected && <section className="business-editor panel" aria-live="polite"><div className="business-editor-heading"><div><span className="eyebrow">{selected.visibility.toUpperCase()} GROUP</span><h2>{selected.name}</h2><p>{selected.description || "No description added."}</p></div><button type="button" className="quiet-button" onClick={() => setSelected(null)}>Close</button></div><div className="business-editor-footer"><span>{selected.owner_id === userId ? "You own this group." : memberships[selected.id]?.status === "active" ? "You are a member." : memberships[selected.id]?.status === "pending" ? "Your membership is pending." : memberships[selected.id]?.status === "banned" ? "This account cannot join this group." : selected.visibility === "public" ? "Join this public group to become a member." : "Private group requests are not available yet."}</span>{selected.owner_id !== userId && selected.visibility === "public" && <button className="button outline" type="button" onClick={() => void join(selected)} disabled={Boolean(joiningGroupId) || Boolean(memberships[selected.id])}>{joiningGroupId === selected.id ? "Joining…" : memberships[selected.id]?.status === "active" ? "Joined" : memberships[selected.id]?.status === "pending" ? "Request pending" : memberships[selected.id]?.status === "banned" ? "Unavailable" : "Join group"}</button>}</div></section>}
  </>;
}
