import React, { useEffect, useState } from "react";
import { createReel, deleteReel, listReels } from "../lib/mediaService.js";

export default function ReelsView({ userId }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState("");

  async function refresh() {
    setError("");
    try {
      setReels(await listReels(userId));
    } catch (loadError) {
      setError(loadError.message || "Reels could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    listReels(userId)
      .then((rows) => { if (active) setReels(rows); })
      .catch((loadError) => { if (active) setError(loadError.message || "Reels could not be loaded."); })
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
      const reel = await createReel(userId, file, caption);
      setReels((current) => [reel, ...current]);
      setFile(null);
      setCaption("");
      setUploadOpen(false);
      setNotice("Your Reel is published.");
    } catch (uploadError) {
      setError(uploadError.message || "Your Reel could not be published.");
    } finally {
      setUploading(false);
    }
  }

  async function removeReel(reel) {
    if (!window.confirm("Delete this Reel and its stored video? This cannot be undone.")) return;
    setDeleting(reel.id);
    setError("");
    try {
      await deleteReel(userId, reel);
      setReels((current) => current.filter((item) => item.id !== reel.id));
      setNotice("Your Reel was deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Your Reel could not be deleted.");
    } finally {
      setDeleting("");
    }
  }

  return <>
    <div className="view-heading"><div><div className="eyebrow">SHORT STORIES, FULL FEELING</div><h1>Reels</h1><p>Videos published by members whose profiles you can view.</p></div><button className="button primary" type="button" onClick={() => setUploadOpen((open) => !open)} aria-expanded={uploadOpen}>＋ Create Reel</button></div>
    {error && <div className="business-feedback error" role="alert">{error}<button className="text-link" type="button" onClick={() => void refresh()}>Retry</button></div>}
    {notice && <div className="business-feedback success" role="status">{notice}</div>}
    {uploadOpen && <form className="reel-create-form panel" onSubmit={submit}><label htmlFor="reel-video">Video file<input id="reel-video" type="file" accept="video/mp4,video/webm" required disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] || null)}/></label><label htmlFor="reel-caption">Caption (optional)<textarea id="reel-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} rows={3} disabled={uploading}/></label><p>MP4 or WebM, up to 100 MB. Your video uploads to private storage before the Reel is published.</p><button className="button primary" type="submit" disabled={!file || uploading}>{uploading ? "Uploading and publishing…" : "Publish Reel"}</button></form>}
    {loading ? <div className="business-state panel" role="status">Loading published Reels…</div> : reels.length ? <div className="reels-feed">{reels.map((reel) => <article className="reel-card panel" key={reel.id}><video src={reel.video_url} poster={reel.cover_url || undefined} controls playsInline preload="metadata" onError={() => setError("A Reel could not be played. Try refreshing or check your connection.")}/><div className="reel-card-copy"><strong>{reel.creator?.display_name?.trim() || (reel.creator?.username ? `@${reel.creator.username}` : "Ofsocio member")}</strong><time dateTime={reel.created_at}>{new Date(reel.created_at).toLocaleDateString()}</time>{reel.caption && <p>{reel.caption}</p>}{reel.creator_id === userId && <button className="business-danger" type="button" onClick={() => void removeReel(reel)} disabled={deleting === reel.id}>{deleting === reel.id ? "Deleting…" : "Delete Reel"}</button>}</div></article>)}</div> : <div className="business-state panel">No published Reels are available yet. Create a Reel to share a video with the community.</div>}
  </>;
}
