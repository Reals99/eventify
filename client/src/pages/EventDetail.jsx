import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const PLATFORM_COLORS = {
  tiktok:    '#010101',
  instagram: '#E1306C',
  facebook:  '#1877F2',
  twitter:   '#000000',
  youtube:   '#FF0000',
};

const STATUS_STYLE = {
  active:   { bg: '#E1F5EE', text: '#1D9E75', label: '● Active' },
  draft:    { bg: '#F1EFE8', text: '#888780', label: '○ Draft' },
  ended:    { bg: '#FAEEDA', text: '#BA7517', label: '■ Ended' },
  archived: { bg: '#F0F0F0', text: '#777',    label: '▪ Archived' },
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event,    setEvent]    = useState(null);
  const [videos,   setVideos]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [copied,   setCopied]   = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const qrRef = useRef(null);

  const primary = event?.theme?.primaryColor || '#7F77DD';

  useEffect(() => {
    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/videos?eventId=${id}&limit=5`),
    ])
      .then(([evRes, vidRes]) => {
        setEvent(evRes.data.event);
        setVideos(vidRes.data.videos || []);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load event.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Generate QR code using Google Charts API (free, no key needed)
  const kioskUrl = event
    ? `${window.location.origin}/kiosk/${event.slug}`
    : '';

  const qrUrl = kioskUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(kioskUrl)}&color=${primary.replace('#','')}&bgcolor=ffffff`
    : '';

  const copyKioskUrl = async () => {
    try {
      await navigator.clipboard.writeText(kioskUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const el = document.createElement('input');
      el.value = kioskUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStatusChange = async (status) => {
    setStatusUpdating(true);
    try {
      const { data } = await api.patch(`/events/${id}/status`, { status });
      setEvent(data.event);
    } catch (e) {
      setError(e.response?.data?.error || 'Status update failed.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${event?.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/events/${id}`);
      navigate('/admin');
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" />
    </div>
  );

  if (error && !event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: 'var(--red)' }}>{error}</p>
      <Link to="/admin" className="btn btn-primary">Back to dashboard</Link>
    </div>
  );

  const ss = STATUS_STYLE[event?.status] || STATUS_STYLE.draft;
  const enabledSocials = Object.entries(event?.socials || {}).filter(([,v]) => v).map(([k]) => k);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', '--ev-primary': primary }}>
      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link to="/admin"><button className="btn btn-ghost btn-sm">← Events</button></Link>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: primary,
          }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>{event?.name}</span>
          <span style={{
            fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 500,
            background: ss.bg, color: ss.text,
          }}>{ss.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/admin/events/${id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
          <Link to={`/admin/events/${id}/review`} className="btn btn-outline btn-sm"
            style={{ borderColor: primary, color: primary }}>
            Review recordings
          </Link>
        </div>
      </nav>

      {error && (
        <div className="alert alert-error" style={{ margin: '16px 24px 0' }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div className="container" style={{ paddingTop: 28, paddingBottom: 48, maxWidth: 1000 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Recordings',  value: event?.stats?.totalRecordings || 0, emoji: '🎬' },
                { label: 'Approved',    value: event?.stats?.approvedCount   || 0, emoji: '✅' },
                { label: 'Flagged',     value: event?.stats?.flaggedCount    || 0, emoji: '🚩' },
                { label: 'Published',   value: event?.stats?.publishedCount  || 0, emoji: '📤' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                  <div style={{ fontSize: 22 }}>{s.emoji}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', margin: '4px 0 2px' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Event info */}
            <div className="card">
              <h2 style={{ marginBottom: 16 }}>Event details</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  ['Date',     event?.date ? new Date(event.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                  ['Location', event?.location || '—'],
                  ['Theme',    event?.theme?.preset ? event.theme.preset.charAt(0).toUpperCase() + event.theme.preset.slice(1) : 'Custom'],
                  ['Frame',    event?.frame?.enabled ? `${event.frame.style} (${event.frame.textPosition})` : 'Disabled'],
                  ['Max recording', `${event?.kiosk?.maxRecordingSeconds || 120}s`],
                  ['Guest name', event?.kiosk?.askGuestName ? 'Requested' : 'Skipped'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {event?.description && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    Description
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>{event.description}</p>
                </div>
              )}
            </div>

            {/* Hashtags + caption */}
            {(event?.hashtags?.length > 0 || event?.postDescription) && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>Social caption</h2>
                {event?.postDescription && (
                  <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{event.postDescription}</p>
                )}
                {event?.hashtags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {event.hashtags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 13, padding: '3px 10px', borderRadius: 20,
                        background: `${primary}1A`, color: primary,
                        border: `1px solid ${primary}44`, fontWeight: 500,
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Socials enabled */}
            <div className="card">
              <h2 style={{ marginBottom: 14 }}>Social platforms</h2>
              {enabledSocials.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  No social platforms selected. <Link to={`/admin/events/${id}/edit`} style={{ color: primary }}>Edit event</Link> to add them.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {enabledSocials.map(p => (
                    <span key={p} style={{
                      fontSize: 13, padding: '5px 14px', borderRadius: 20,
                      background: `${PLATFORM_COLORS[p]}15`,
                      color: PLATFORM_COLORS[p] === '#010101' ? '#333' : PLATFORM_COLORS[p],
                      border: `1px solid ${PLATFORM_COLORS[p]}44`,
                      fontWeight: 500, textTransform: 'capitalize',
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recent recordings */}
            {videos.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h2>Recent recordings</h2>
                  <Link to={`/admin/events/${id}/review`}
                    style={{ fontSize: 13, color: primary, textDecoration: 'none', fontWeight: 500 }}>
                    View all →
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {videos.map(v => (
                    <div key={v._id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 8,
                      background: 'var(--bg)', border: '0.5px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 18 }}>{v.recordingType === 'video' ? '🎥' : '🎙️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{v.guestName || 'Anonymous'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {v.phase === 'expectation' ? 'Before' : 'After'} · {new Date(v.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                        background: v.status === 'approved' ? '#E1F5EE' : v.status === 'flagged' ? '#FCEBEB' : '#FAEEDA',
                        color:      v.status === 'approved' ? '#1D9E75' : v.status === 'flagged' ? '#E24B4A' : '#BA7517',
                        textTransform: 'capitalize',
                      }}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger zone */}
            <div className="card" style={{ border: '1px solid #FECACA' }}>
              <h2 style={{ marginBottom: 14, color: 'var(--red)' }}>Danger zone</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {event?.status !== 'ended' && (
                  <button className="btn btn-sm"
                    style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: 'none' }}
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('ended')}>
                    End event
                  </button>
                )}
                {event?.status !== 'archived' && (
                  <button className="btn btn-sm"
                    style={{ background: '#F0F0F0', color: '#666', border: 'none' }}
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('archived')}>
                    Archive
                  </button>
                )}
                <button className="btn btn-sm btn-danger"
                  onClick={handleDelete}>
                  Delete event
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column: kiosk card ─────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 72 }}>
            <div className="card" style={{
              border: `2px solid ${primary}`,
              background: `linear-gradient(135deg, ${primary}08, transparent)`,
            }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: primary,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                }}>
                  Guest Kiosk
                </div>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>Share this with your guests</h3>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Display or print the QR code at your event entrance
                </p>
              </div>

              {/* QR code */}
              {qrUrl && (
                <div style={{
                  display: 'flex', justifyContent: 'center',
                  padding: 12, background: '#fff',
                  borderRadius: 12, marginBottom: 14,
                  border: '0.5px solid var(--border)',
                }}>
                  <img
                    ref={qrRef}
                    src={qrUrl}
                    alt="Kiosk QR code"
                    width={160}
                    height={160}
                    style={{ display: 'block', borderRadius: 4 }}
                  />
                </div>
              )}

              {/* Kiosk URL */}
              <div style={{
                background: 'var(--bg)', borderRadius: 8,
                padding: '8px 12px', marginBottom: 12,
                border: '0.5px solid var(--border)',
                fontFamily: 'monospace', fontSize: 11,
                color: 'var(--text-2)', wordBreak: 'break-all',
              }}>
                {kioskUrl}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: primary, width: '100%' }}
                  onClick={copyKioskUrl}
                >
                  {copied ? '✓ Copied!' : '📋 Copy kiosk link'}
                </button>

                <a
                  href={`/kiosk/${event?.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  ↗ Open kiosk
                </a>

                <a
                  href={qrUrl}
                  download={`${event?.slug}-qr.png`}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  ⬇ Download QR code
                </a>
              </div>

              {/* Status actions */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, fontWeight: 500 }}>
                  EVENT STATUS
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['draft', 'active', 'ended'].map(s => (
                    <button key={s} className="btn btn-sm"
                      disabled={event?.status === s || statusUpdating}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        flex: 1,
                        textTransform: 'capitalize',
                        background: event?.status === s ? primary : 'var(--surface)',
                        color: event?.status === s ? '#fff' : 'var(--text-2)',
                        border: `1px solid ${event?.status === s ? primary : 'var(--border)'}`,
                        fontSize: 11,
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
