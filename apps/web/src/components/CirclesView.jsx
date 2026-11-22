import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  cancelFollowRequest,
  followUser,
  loadCircleState,
  respondToFollowRequest,
  searchPeople,
  unfollowUser
} from "../lib/circleService.js";
import { normalizePeopleSearch } from "../lib/circleValidation.js";

const initialState = { following: [], followers: [], incomingRequests: [], outgoingRequests: [] };

function displayName(profile) {
  if (profile?.is_private) return profile.username ? `@${profile.username}` : "Private member";
  return profile?.display_name?.trim() || (profile?.username ? `@${profile.username}` : "Ofsocio member");
}

function MemberCard({ profile, detail, children }) {
  const initials = displayName(profile).replace(/^@/, "").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  return <article className="person-card panel circle-person-card">
    <div className="person-cover" />
    <span className="avatar avatar-fallback large circle-avatar" aria-hidden="true">{initials || "O"}</span>
    <div className="person-info">
      <h3>{displayName(profile)}</h3>
      {profile?.username && !profile?.is_private && <span>@{profile.username}</span>}
      <p>{detail}</p>
      {children && <div className="circle-card-actions">{children}</div>}
    </div>
  </article>;
}

export default function CirclesView({ userId, search, onSearchChange }) {
  const [tab, setTab] = useState("discover");
  const [circleState, setCircleState] = useState(initialState);
  const [stateLoading, setStateLoading] = useState(true);
  const [stateError, setStateError] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState("");
  const requestSequence = useRef(0);

  async function refreshState() {
    if (!userId) {
      setCircleState(initialState);
      setStateError("Sign in to use Circles.");
      setStateLoading(false);
      return;
    }
    setStateLoading(true);
    setStateError("");
    try {
      setCircleState(await loadCircleState(userId));
    } catch (error) {
      setStateError(error.message || "Your Circles could not be loaded.");
    } finally {
      setStateLoading(false);
    }
  }

  useEffect(() => {
    void refreshState();
  }, [userId]);

  const normalizedSearch = normalizePeopleSearch(search || "");
  useEffect(() => {
    const sequence = ++requestSequence.current;
    let active = true;
    if (normalizedSearch.length < 2) {
      setResults([]);
      setSearchError("");
      setSearchLoading(false);
      return () => { active = false; };
    }

    setSearchLoading(true);
    setSearchError("");
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchPeople(userId, normalizedSearch);
        if (active && sequence === requestSequence.current) setResults(rows);
      } catch (error) {
        if (active && sequence === requestSequence.current) setSearchError(error.message || "People search failed.");
      } finally {
        if (active && sequence === requestSequence.current) setSearchLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedSearch, userId]);

  const followingIds = useMemo(() => new Set(circleState.following.map((row) => row.followed_id)), [circleState.following]);
  const outgoingRequestIds = useMemo(() => new Set(circleState.outgoingRequests.map((row) => row.profile_id)), [circleState.outgoingRequests]);

  async function mutate(key, action, successMessage) {
    if (busyKey) return;
    setBusyKey(key);
    setStateError("");
    setSearchError("");
    setNotice("");
    try {
      await action();
      await refreshState();
      setNotice(successMessage);
    } catch (error) {
      setStateError(error.message || "That Circles action could not be completed.");
    } finally {
      setBusyKey("");
    }
  }

  function followAction(profile) {
    const isFollowing = followingIds.has(profile.id);
    const hasRequest = outgoingRequestIds.has(profile.id);
    if (isFollowing) {
      return <button className="button outline full-button" type="button" disabled={Boolean(busyKey)} onClick={() => void mutate(`follow:${profile.id}`, () => unfollowUser(userId, profile.id), "You unfollowed this member.")}> {busyKey === `follow:${profile.id}` ? "Updating…" : "Following · Unfollow"}</button>;
    }
    if (hasRequest) {
      const request = circleState.outgoingRequests.find((row) => row.profile_id === profile.id);
      return <button className="button outline full-button" type="button" disabled={Boolean(busyKey)} onClick={() => void mutate(`request:${request.request_id}`, () => cancelFollowRequest(userId, request.request_id), "Your follow request was cancelled.")}>{busyKey === `request:${request.request_id}` ? "Cancelling…" : "Pending · Cancel request"}</button>;
    }
    const privateAccount = Boolean(profile.is_private);
    return <button className="button primary full-button" type="button" disabled={Boolean(busyKey)} onClick={() => void mutate(`follow:${profile.id}`, () => followUser(userId, profile.id), privateAccount ? "Follow request sent." : "You are now following this member.")}>{busyKey === `follow:${profile.id}` ? "Sending…" : privateAccount ? "Request to follow" : "＋ Follow"}</button>;
  }

  const tabs = [
    ["discover", "Discover", null],
    ["requests", "Requests", circleState.incomingRequests.length],
    ["following", "Following", circleState.following.length],
    ["followers", "Followers", circleState.followers.length]
  ];

  return <>
    <div className="view-heading"><div><div className="eyebrow">YOUR PEOPLE, YOUR PACE</div><h1>Circles</h1><p>Find members and manage your follow connections.</p></div></div>
    <div className="filter-row circle-search-row">
      <label className="quiet-button filter-search circle-search">⌕ <input value={search || ""} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search by name or username" aria-label="Search people" maxLength={70} /></label>
    </div>
    <div className="segmented" role="tablist" aria-label="Circles">
      {tabs.map(([id, label, count]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}{count > 0 && <b>{count}</b>}</button>)}
    </div>
    {(stateError || searchError) && <div className="business-feedback error" role="alert">{stateError || searchError}<button className="text-link" type="button" onClick={() => void refreshState()}>Retry</button></div>}
    {notice && <div className="business-feedback success" role="status">{notice}</div>}

    {tab === "discover" && (normalizedSearch.length < 2
      ? <div className="business-state panel">Search by a name or username to find Ofsocio members. Private accounts appear only for an exact username match and show limited profile details.</div>
      : searchLoading ? <div className="business-state panel" role="status">Searching Ofsocio members…</div>
        : results.length ? <div className="people-grid">{results.map((profile) => <MemberCard key={profile.id} profile={profile} detail={profile.is_private ? "Private account · limited details" : "Ofsocio member"}>{followAction(profile)}</MemberCard>)}</div>
          : !searchError && <div className="business-state panel">No visible members matched that search.</div>)}

    {tab === "requests" && (stateLoading ? <div className="business-state panel" role="status">Loading follow requests…</div>
      : circleState.incomingRequests.length || circleState.outgoingRequests.length ? <div className="circle-request-sections">
        {circleState.incomingRequests.length > 0 && <section><h2>Incoming requests</h2><div className="people-grid">{circleState.incomingRequests.map((request) => <MemberCard key={request.request_id} profile={request} detail={request.is_blocked ? "A blocked account sent this request. It can be declined, but not accepted." : `Requested ${new Date(request.created_at).toLocaleDateString()}`}><button className="button primary full-button" type="button" disabled={Boolean(busyKey) || request.is_blocked} onClick={() => void mutate(`response:${request.request_id}`, () => respondToFollowRequest(userId, request.request_id, "accept"), "Follow request accepted.")}>{request.is_blocked ? "Blocked" : busyKey === `response:${request.request_id}` ? "Saving…" : "Accept"}</button><button className="text-button" type="button" disabled={Boolean(busyKey)} onClick={() => void mutate(`response:${request.request_id}`, () => respondToFollowRequest(userId, request.request_id, "reject"), "Follow request declined.")}>Decline</button></MemberCard>)}</div></section>}
        {circleState.outgoingRequests.length > 0 && <section><h2>Sent requests</h2><div className="people-grid">{circleState.outgoingRequests.map((request) => <MemberCard key={request.request_id} profile={request} detail="Waiting for approval"><button className="button outline full-button" type="button" disabled={Boolean(busyKey)} onClick={() => void mutate(`request:${request.request_id}`, () => cancelFollowRequest(userId, request.request_id), "Your follow request was cancelled.")}>{busyKey === `request:${request.request_id}` ? "Cancelling…" : "Cancel request"}</button></MemberCard>)}</div></section>}
      </div> : <div className="business-state panel">You have no incoming or sent follow requests.</div>)}

    {tab === "following" && (stateLoading ? <div className="business-state panel" role="status">Loading people you follow…</div>
      : circleState.following.length ? <div className="people-grid">{circleState.following.map((row) => <MemberCard key={row.followed_id} profile={row.profile} detail="You follow this member">{followAction(row.profile)}</MemberCard>)}</div>
        : <div className="business-state panel">You are not following anyone yet. Search for a member to get started.</div>)}

    {tab === "followers" && (stateLoading ? <div className="business-state panel" role="status">Loading your followers…</div>
      : circleState.followers.length ? <div className="people-grid">{circleState.followers.map((row) => <MemberCard key={row.follower_id} profile={row.profile} detail="Follows you">{followAction(row.profile)}</MemberCard>)}</div>
        : <div className="business-state panel">You do not have any followers yet.</div>)}
  </>;
}
