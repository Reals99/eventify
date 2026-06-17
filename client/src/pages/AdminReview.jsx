import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import VideoCard from '../../components/VideoCard';
import ProcessingSpinner from '../../components/ProcessingSpinner';
import PublishPanel from '../../components/PublishPanel';
import useProcessing from '../../hooks/useProcessing';

const FILTER_TABS = [
  { id: 'all',      label: 'All' },
  { id: 'pending',  label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'flagged',  label: 'Flagged' },
];

export default function AdminReview() {
  const { id: eventId } = useParams();
  const [event,      setEvent]      = useState(null);
  const [videos,     setVideos]     = useState([]);
  const [selected,   setSelected]   = useState(null);   // current Video object
  const [filter,     setFilter]     = useState('all');
  const [loading,    setLoading]    = useState(true);
  const [reviewing,  setReviewing]  = useState(false);  // review action in flight
  const [reviewNote, setReviewNote] = useState('');
  const [showNote,   setShowNote]   = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [editCaption, setEditCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState({ caption: '', hashtags: [] });
  const [tagInput, setTagInput]     = useState('');
  const [error, setError]           = useState('');

  // Processing hook for current video
  const processing = useProcessing(selected?._id);

  const primary = event?.theme?.primaryColor || '#7F77DD';

  // ── Load event + videos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.get(`/events/${eventId}`),
      api.get(`/videos?eventId=${eventId}`),
    ])
      .then(([evRes, vidRes]) => {
        setEvent(evRes.data.event);
        setVideos(vidRes.data.videos);
        if (vidRes.data.videos.length > 0) pickVideo(vidRes.data.videos[0]);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const pickVideo = useCallback((v) => {
    setSelected(v);
    setReviewNote(v.reviewNote || '');
    setShowNote(false);
    setEditCaption(false);
    setCaptionDraft({ caption: v.caption || '', hashtags: v.hashtags || [] });
    setTagInput('');
    processing.stopPolling();
    // If framed already done, mark ready
    if (v.processed?.framed?.url) {
      // no-op — polling not needed
    }
  }, [processing]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredVideos = filter === 'all' ? videos : videos.filter(v => v.status === filter);

  // ── Review action ───────────────────────────────────────────────────────────
  const handleReview = async (status) => {
    if (!selected) return;
    setReviewing(true);
    setError('');
    try {
      const { data } = await api.patch(`/videos/${selected._id}/review`, {
        status,
        reviewNote: reviewNote.trim(),
      });
      const updated = data.video;
      setVideos(vs => vs.map(v => v._id === updated._id ? updated : v));
      setSelected(updated);

      // Automatically start processing when approved + frame enabled
      if (status === 'approved' && event?.frame?.enabled && !updated.processed?.framed?.url) {
        triggerProcessing(updated._id);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Review failed.');
    } finally {
      setReviewing(false);
    }
  };

  // ── Trigger FFmpeg processing ───────────────────────────────────────────────
  const triggerProcessing = async (videoId) => {
    try {
      await api.post(`/process/${videoId}`);
      processing.startPolling();
    } catch (e) {
      setError('Processing trigger failed: ' + (e.response?.data?.error || e.message));
    }
  };

  // When processing finishes, refresh the selected video from server
  useEffect(() => {
    if (!processing.ready || !selected) return;
    api.get(`/videos/${selected._id}`)
      .then(({ data }) => {
        setSelected(data.video);
        setVideos(vs => vs.map(v => v._id === data.video._id ? data.video : v));
      })
      .catch(() => {});
  }, [processing.ready]);

  // ── AI caption generation ───────────────────────────────────────────────────
  const generateCaption = async () => {
    if (!event) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai/caption', {
        name: event.name,
        description: `${event.description || ''} — recorded by ${selected?.guestName || 'a guest'} (${selected?.phase})`,
        date: event.date,
        location: event.location,
      });
      setCaptionDraft({ caption: data.description || '', hashtags: data.hashtags || [] });
    } catch (e) {
      setError('AI generation failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setAiLoading(false);
    }
  };

  // ── Save caption overrides ──────────────────────────────────────────────────
  const saveCaption = async () => {
    try {
      const { data } = await api.patch(`/videos/${selected._id}/caption`, captionDraft);
      setSelected(data.video);
      setVideos(vs => vs.map(v => v._id === data.video._id ? data.video : v));
      setEditCaption(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Caption save failed.');
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g,'');
    if (!tag || captionDraft.hashtags.includes(tag) || captionDraft.hashtags.length >= 5) return;
    setCaptionDraft(d => ({ ...d, hashtags: [...d.hashtags, tag] }));
    setTagInput('');
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const isProcessing    = processing.processing;
  const frameReady      = processing.ready || !!(selected?.processed?.framed?.url);
  const framedUrl       = processing.framedUrl || selected?.processed?.framed?.url;
  const rawUrl          = selected?.cloudinary?.secureUrl;
  const isApproved      = selected?.status === 'approved';
  const isFlagged       = selected?.status === 'flagged';
  const frameEnabled    = event?.frame?.enabled;

  if (loading) return (
    <div className="flex-center" style={{ height: '100vh' }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', '--ev-primary': primary }}>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link to="/admin"><button className="btn btn-ghost btn-sm">← Events</button></Link>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{event?.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>
            Review recordings
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
            {videos.filter(v => v.status === 'pending').length} pending
          </span>
          <span style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
            {videos.filter(v => v.status === 'approved').length} approved
          </span>
        </div>
      </nav>

      {error && (
        <div className="alert alert-error" style={{ margin: '12px 20px 0' }}>{error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ── Left sidebar: video list ────────────────────────────────────── */}
        <div style={{
          borderRight: '0.5px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            {FILTER_TABS.map(tab => (
              <button key={tab.id} onClick={() => setFilter(tab.id)}
                style={{
                  flex: 1, padding: '10px 4px', border: 'none', background: 'none',
                  borderBottom: filter === tab.id ? `2px solid ${primary}` : '2px solid transparent',
                  fontSize: 12, fontWeight: filter === tab.id ? 600 : 400,
                  color: filter === tab.id ? primary : 'var(--text-2)',
                  cursor: 'pointer',
                }}>
                {tab.label}
                <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-3)' }}>
                  {tab.id === 'all' ? videos.length : videos.filter(v => v.status === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {filteredVideos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                No {filter !== 'all' ? filter : ''} recordings
              </div>
            ) : (
              filteredVideos.map(v => (
                <VideoCard
                  key={v._id}
                  video={v}
                  selected={selected?._id === v._id}
                  onClick={() => pickVideo(v)}
                  primaryColor={primary}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: video detail ─────────────────────────────────────────── */}
        <div style={{ overflowY: 'auto', padding: '20px 24px' }}>
          {!selected ? (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-3)', fontSize: 14 }}>
              Select a recording from the list
            </div>
          ) : (
            <div style={{ maxWidth: 860, margin: '0 auto' }}>

              {/* ── Guest info row ──────────────────────────────────────── */}
              <div className="flex-between" style={{ marginBottom: 20 }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>{selected.guestName || 'Anonymous'}</h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489', fontWeight: 500 }}>
                      {selected.phase === 'expectation' ? '✨ Before event' : '🏁 After event'}
                    </span>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: 'var(--bg)', color: 'var(--text-2)', border: '0.5px solid var(--border)' }}>
                      {selected.recordingType === 'video' ? '🎥 Video' : '🎙️ Audio'}
                    </span>
                    <span className={`badge badge-${selected.status}`} style={{ textTransform: 'capitalize' }}>
                      {selected.status}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                  {new Date(selected.createdAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {selected.cloudinary?.duration ? (
                    <div style={{ marginTop: 2 }}>
                      Duration: {Math.floor(selected.cloudinary.duration / 60)}:{String(Math.round(selected.cloudinary.duration % 60)).padStart(2,'0')}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
                {/* ── Video preview area ────────────────────────────────── */}
                <div>
                  {/* Tab: Raw vs Framed */}
                  {frameReady && (
                    <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
                      {[
                        { key: 'raw',    label: '📹 Raw' },
                        { key: 'framed', label: '🎬 Framed' },
                      ].map(tab => (
                        <button key={tab.key}
                          onClick={() => setSelected(s => ({ ...s, _previewTab: tab.key }))}
                          style={{
                            padding: '7px 18px', border: 'none', cursor: 'pointer',
                            borderBottom: (selected._previewTab || 'raw') === tab.key ? `2px solid ${primary}` : '2px solid transparent',
                            background: 'none', fontSize: 13, fontWeight: 500,
                            color: (selected._previewTab || 'raw') === tab.key ? primary : 'var(--text-2)',
                          }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Video / Audio player */}
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#111' }}>
                    {isProcessing && <ProcessingSpinner primaryColor={primary} />}

                    {selected.recordingType === 'video' ? (
                      <video
                        key={(selected._previewTab === 'framed' && framedUrl) ? framedUrl : rawUrl}
                        src={(selected._previewTab === 'framed' && framedUrl) ? framedUrl : rawUrl}
                        controls
                        style={{ width: '100%', display: 'block', borderRadius: 12, maxHeight: 400 }}
                      />
                    ) : (
                      <div style={{ padding: '28px 24px', background: 'var(--bg)', borderRadius: 12 }}>
                        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🎙️</div>
                        <audio
                          src={rawUrl}
                          controls
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Framed preview ready notice */}
                  {frameReady && framedUrl && (
                    <div style={{ marginTop: 10, padding: '8px 14px', background: 'var(--green-bg)', borderRadius: 8, fontSize: 13, color: '#085041', display: 'flex', alignItems: 'center', gap: 8 }}>
                      ✅ Frame overlay applied — click <strong>Framed</strong> tab to preview
                    </div>
                  )}

                  {/* Cloudinary + Drive links */}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {rawUrl && (
                      <a href={rawUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                        ↗ Raw on Cloudinary
                      </a>
                    )}
                    {selected.drive?.webViewLink && (
                      <a href={selected.drive.webViewLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                        📁 View on Drive
                      </a>
                    )}
                    {framedUrl && (
                      <a href={framedUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                        🎬 Framed video
                      </a>
                    )}
                  </div>

                  {/* Social platform variants */}
                  {(selected.processed?.tiktok?.url || selected.processed?.instagram?.url ||
                    selected.processed?.facebook?.url || selected.processed?.twitter?.url ||
                    selected.processed?.youtube?.url) && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Social variants ready
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          ['tiktok', '🎵 TikTok'],
                          ['instagram', '📸 Instagram'],
                          ['facebook', '👥 Facebook'],
                          ['twitter', '𝕏 Twitter'],
                          ['youtube', '▶️ YouTube'],
                        ].map(([key, label]) => selected.processed?.[key]?.url ? (
                          <a key={key} href={selected.processed[key].url} target="_blank" rel="noreferrer"
                            className="btn btn-ghost btn-sm">
                            {label}
                          </a>
                        ) : null)}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Right panel: actions + caption ───────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Review actions */}
                  <div className="card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Review decision
                    </div>

                    <button
                      className="btn btn-success"
                      style={{ width: '100%', marginBottom: 8 }}
                      disabled={reviewing || isApproved}
                      onClick={() => handleReview('approved')}
                    >
                      {reviewing ? <span className="spinner" /> : isApproved ? '✓ Approved' : '✓ Approve'}
                    </button>

                    <button
                      className="btn"
                      style={{
                        width: '100%', marginBottom: 8,
                        background: 'var(--red-bg)', color: 'var(--red)', border: 'none',
                        opacity: isFlagged ? 0.55 : 1,
                      }}
                      disabled={reviewing || isFlagged}
                      onClick={() => { setShowNote(true); }}
                    >
                      🚩 {isFlagged ? 'Flagged' : 'Flag for review'}
                    </button>

                    {showNote && !isFlagged && (
                      <div style={{ marginBottom: 8 }}>
                        <textarea
                          rows={2}
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          placeholder="Add a note (optional)…"
                          style={{ fontSize: 13, marginBottom: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ flex: 1, background: 'var(--red)', color: '#fff', border: 'none' }}
                            onClick={() => handleReview('flagged')}>
                            Confirm flag
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowNote(false)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {selected.reviewNote && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, marginTop: 4 }}>
                        📝 {selected.reviewNote}
                      </div>
                    )}
                  </div>

                  {/* Re-process button */}
                  {isApproved && frameEnabled && (
                    <div className="card" style={{ padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Frame overlay
                      </div>
                      {frameReady ? (
                        <div style={{ fontSize: 13, color: 'var(--green)' }}>✅ Frame applied ({event.frame?.style})</div>
                      ) : isProcessing ? (
                        <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                          Processing…
                        </div>
                      ) : (
                        <button className="btn btn-primary btn-sm" style={{ width: '100%', background: primary }}
                          onClick={() => triggerProcessing(selected._id)}>
                          ▶ Apply frame now
                        </button>
                      )}
                      {processing.error && (
                        <div className="alert alert-error" style={{ marginTop: 8, fontSize: 12 }}>{processing.error}</div>
                      )}
                    </div>
                  )}

                  {/* Publish panel — show when approved */}
                  {isApproved && (
                    <PublishPanel
                      video={selected}
                      event={event}
                      primaryColor={primary}
                      onPublished={() => {
                        api.get(`/videos/${selected._id}`)
                          .then(({ data }) => {
                            setSelected(data.video);
                            setVideos(vs => vs.map(v => v._id === data.video._id ? data.video : v));
                          })
                          .catch(() => {});
                      }}
                    />
                  )}

                  {/* Caption & Hashtags */}
                  <div className="card" style={{ padding: 16 }}>
                    <div className="flex-between" style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Caption
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditCaption(e => !e)}>
                        {editCaption ? 'Cancel' : 'Edit'}
                      </button>
                    </div>

                    {editCaption ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                          <button className="btn btn-sm"
                            onClick={generateCaption} disabled={aiLoading}
                            style={{ background: primary, color: '#fff', border: 'none', fontSize: 12 }}>
                            {aiLoading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : '✨ AI generate'}
                          </button>
                        </div>
                        <textarea rows={3} value={captionDraft.caption}
                          onChange={e => setCaptionDraft(d => ({ ...d, caption: e.target.value }))}
                          placeholder="Post caption…" style={{ fontSize: 13, marginBottom: 8 }} />
                        {/* Hashtags */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <input type="text" value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                            placeholder="Add tag" style={{ flex: 1, fontSize: 13 }}
                            disabled={captionDraft.hashtags.length >= 5} />
                          <button className="btn btn-sm" onClick={addTag}
                            disabled={captionDraft.hashtags.length >= 5 || !tagInput.trim()}
                            style={{ background: primary, color: '#fff', border: 'none' }}>+</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                          {captionDraft.hashtags.map(tag => (
                            <span key={tag} style={{
                              fontSize: 12, padding: '2px 8px', borderRadius: 20,
                              background: '#EEEDFE', color: '#3C3489',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              #{tag}
                              <button onClick={() => setCaptionDraft(d => ({ ...d, hashtags: d.hashtags.filter(t => t !== tag) }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, padding: 0 }}>×</button>
                            </span>
                          ))}
                        </div>
                        <button className="btn btn-primary btn-sm" style={{ width: '100%', background: primary }}
                          onClick={saveCaption}>Save caption</button>
                      </>
                    ) : (
                      <>
                        {selected.caption ? (
                          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-1)', marginBottom: 8 }}>{selected.caption}</p>
                        ) : (
                          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>
                            Uses event default caption
                          </p>
                        )}
                        {(selected.hashtags?.length > 0 || event?.hashtags?.length > 0) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {(selected.hashtags?.length > 0 ? selected.hashtags : event?.hashtags || []).map(tag => (
                              <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489' }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
