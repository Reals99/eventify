import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

const PLATFORMS = [
  { id: 'tiktok',    label: 'TikTok',     icon: '🎵', color: '#010101' },
  { id: 'instagram', label: 'Instagram',  icon: '📸', color: '#E1306C' },
  { id: 'facebook',  label: 'Facebook',   icon: '👥', color: '#1877F2' },
  { id: 'twitter',   label: 'X / Twitter',icon: '✖',  color: '#000000' },
  { id: 'youtube',   label: 'YouTube',    icon: '▶',  color: '#FF0000' },
];

/**
 * Publish panel shown in the review screen for approved videos.
 * Shows which platforms are connected, lets admin pick platforms, and publish.
 *
 * @param {object} video       — the video document
 * @param {object} event       — the event document
 * @param {string} primaryColor
 * @param {function} onPublished — callback after successful publish
 */
export default function PublishPanel({ video, event, primaryColor, onPublished }) {
  const [connected,   setConnected]   = useState({});
  const [selected,    setSelected]    = useState([]);
  const [publishing,  setPublishing]  = useState(false);
  const [pollStatus,  setPollStatus]  = useState({});
  const [error,       setError]       = useState('');
  const pollRef = useRef(null);

  const color = primaryColor || '#7F77DD';

  // Load which platforms are connected
  useEffect(() => {
    api.get('/social/status')
      .then(({ data }) => {
        setConnected(data.status);
        // Pre-select platforms that are both connected and enabled for this event
        const eventSocials = event?.socials || {};
        const preselect = PLATFORMS
          .filter(p => data.status[p.id] && eventSocials[p.id])
          .map(p => p.id);
        setSelected(preselect);
      })
      .catch(() => {});
  }, [event]);

  // Seed published state from video doc
  useEffect(() => {
    if (!video?.published) return;
    const s = {};
    PLATFORMS.forEach(p => {
      if (video.published[p.id]?.done)  s[p.id] = 'done';
      if (video.published[p.id]?.error) s[p.id] = 'error';
    });
    setPollStatus(s);
  }, [video]);

  const togglePlatform = (id) => {
    setSelected(sel =>
      sel.includes(id) ? sel.filter(s => s !== id) : [...sel, id]
    );
  };

  const handlePublish = async () => {
    if (!selected.length) return;
    setPublishing(true);
    setError('');
    try {
      await api.post(`/social/publish/${video._id}`, { platforms: selected });
      // Start polling for results
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/social/publish/${video._id}/status`);
          const pub = data.published || {};
          const newStatus = {};
          let allSettled = true;

          selected.forEach(pid => {
            if (pub[pid]?.done)  newStatus[pid] = 'done';
            else if (pub[pid]?.error) newStatus[pid] = 'error';
            else { newStatus[pid] = 'publishing'; allSettled = false; }
          });

          setPollStatus(ps => ({ ...ps, ...newStatus }));

          if (allSettled) {
            clearInterval(pollRef.current);
            setPublishing(false);
            onPublished?.();
          }
        } catch {
          clearInterval(pollRef.current);
          setPublishing(false);
        }
      }, 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Publish failed.');
      setPublishing(false);
    }
  };

  // Stop polling on unmount
  useEffect(() => () => clearInterval(pollRef.current), []);

  const enabledSocials = Object.entries(event?.socials || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  const statusIcon = (pid) => {
    const s = pollStatus[pid];
    if (s === 'done')       return <span style={{ color: '#1D9E75', fontSize: 13 }}>✓</span>;
    if (s === 'error')      return <span style={{ color: '#E24B4A', fontSize: 13 }}>✗</span>;
    if (s === 'publishing') return <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />;
    return null;
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Publish to socials
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 10, fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {PLATFORMS.map(p => {
          const isConnected   = connected[p.id];
          const isEnabledEvent = enabledSocials.includes(p.id);
          const isSelected    = selected.includes(p.id);
          const pubState      = pollStatus[p.id];
          const alreadyDone   = pubState === 'done';

          return (
            <label key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, cursor: isConnected ? 'pointer' : 'default',
              border: `1px solid ${isSelected && isConnected ? p.color : 'var(--border)'}`,
              background: isSelected && isConnected ? p.color + '12' : 'transparent',
              opacity: isConnected ? 1 : 0.45,
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: 0,
            }}>
              <input type="checkbox"
                checked={isSelected}
                disabled={!isConnected || publishing || alreadyDone}
                onChange={() => isConnected && togglePlatform(p.id)}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
                {p.label}
              </span>

              {statusIcon(p.id)}

              {!isConnected && (
                <a href={`/api/social/${p.id}/connect`}
                  style={{ fontSize: 11, color: color, textDecoration: 'none', fontWeight: 500 }}>
                  Connect ↗
                </a>
              )}
              {isConnected && !isEnabledEvent && (
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>not in event</span>
              )}
              {alreadyDone && (
                <span style={{ fontSize: 10, color: '#1D9E75', fontWeight: 500 }}>Published</span>
              )}
            </label>
          );
        })}
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', background: color, fontSize: 13 }}
        disabled={!selected.length || publishing || selected.every(id => pollStatus[id] === 'done')}
        onClick={handlePublish}
      >
        {publishing ? (
          <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Publishing…</>
        ) : (
          `🚀 Publish to ${selected.length} platform${selected.length !== 1 ? 's' : ''}`
        )}
      </button>

      {Object.values(pollStatus).some(s => s === 'error') && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>
          Some platforms failed — check server logs. You can retry individual platforms.
        </div>
      )}
    </div>
  );
}
