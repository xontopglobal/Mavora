import React, { useEffect, useState } from "react";
import { createStory, deleteStory, getStoryViewCount, listStories, recordStoryView } from "../lib/mediaService.js";

function nameFor(story, userId) {
  if (story?.user_id === userId) return "Your story";
  return story?.profile?.display_name?.trim() || (story?.profile?.username ? `@${story.profile.username}` : "Ofsocio member");
}

export default function StoriesPanel({ userId }) {
  const [stories, setStories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [viewCount, setViewCount] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setError("");
    try {
      setStories(await listStories(userId));
    } catch (loadError) {
      setError(loadError.message || "Stories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    listStories(userId)
      .then((rows) => { if (active) setStories(rows); })
      .catch((loadError) => { if (active) setError(loadError.message || "Stories could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function submit(event) {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const story = await createStory(userId, file, caption);
      setStories((current) => [story, ...current]);
      setFile(null);
      setCaption("");
      setFormOpen(false);
      setNotice("Your Story was shared and will expire after 24 hours.");
    } catch (uploadError) {
      setError(uploadError.message || "Your Story could not be shared.");
    } finally {
      setUploading(false);
    }
  }

  async function removeSelected() {
    if (!selected || selected.user_id !== userId) return;
    if (!window.confirm("Delete this Story? This cannot be undone.")) return;
    try {
      await deleteStory(userId, selected);
      setStories((current) => current.filter((story) => story.id !== selected.id));
      setSelected(null);
      setNotice("Your Story was deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Your Story could not be deleted.");
    }
  }

  async function openStory(story) {
    setSelected(story);
    setViewCount(null);
    setError("");
    try {
      if (story.user_id === userId) setViewCount(await getStoryViewCount(userId, story.id));
      else await recordStoryView(userId, story.id);
    } catch (viewError) {
      setError(viewError.message || "This Story view could not be recorded.");
    }
  }

  return <>
    <section className="stories-panel" aria-labelledby="stories-heading">
      <div className="stories-heading"><div><h2 id="stories-heading">Stories</h2><p>Share a moment with people you follow.</p></div><button className="quiet-button" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>
      <div className="stories-rail"><button className="story-tile add-story-tile" type="button" onClick={() => setFormOpen((open) => !open)} aria-expanded={formOpen}><span className="story-add" aria-hidden="true">＋</span><strong>Your story</strong></button>{stories.map((story) => <button className="story-tile" type="button" key={story.id} onClick={() => void openStory(story)}><span className="story-thumb">{story.media_type === "video" ? <span aria-hidden="true">▶</span> : <img src={story.media_url} alt=""/>}</span><strong>{nameFor(story, userId)}</strong></button>)}</div>
      {loading && <p className="stories-feedback" role="status">Loading active Stories…</p>}
      {!loading && !stories.length && <p className="stories-feedback">No active Stories yet. Share one with your followers.</p>}
      {error && <p className="profile-error" role="alert">{error}</p>}
      {notice && <p className="profile-save-message" role="status">{notice}</p>}
      {formOpen && <form className="story-create-form" onSubmit={submit}><label htmlFor="story-file">Photo or video<input id="story-file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={(event) => setFile(event.target.files?.[0] || null)} required disabled={uploading}/></label><label htmlFor="story-caption">Caption (optional)<input id="story-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={280} placeholder="Add a caption" disabled={uploading}/></label><p>Photos up to 10 MB; videos up to 50 MB. Active for 24 hours.</p><button className="button primary" type="submit" disabled={!file || uploading}>{uploading ? "Uploading Story…" : "Share Story"}</button></form>}
    </section>
    {selected && <div className="story-viewer-backdrop"><section className="story-viewer panel" role="dialog" aria-modal="true" aria-labelledby="story-viewer-title"><header><strong id="story-viewer-title">{nameFor(selected, userId)}</strong><button className="quiet-button" type="button" onClick={() => { setSelected(null); setViewCount(null); }} aria-label="Close Story">Close</button></header>{selected.media_type === "video" ? <video src={selected.media_url} controls autoPlay playsInline/> : <img src={selected.media_url} alt={selected.caption || `${nameFor(selected, userId)}’s Story`}/>}<p>{selected.caption || ""}</p>{selected.user_id === userId && <><small>{viewCount === null ? "Loading view count…" : `${viewCount} unique ${viewCount === 1 ? "view" : "views"}`}</small><button className="business-danger" type="button" onClick={() => void removeSelected()}>Delete Story</button></>}</section></div>}
  </>;
}
