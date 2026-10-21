import { useState, useEffect } from 'react';
import api from '../utils/api';

const PLATFORMS = [
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    color: '#010101',
    bg: '#f0f0f0',
    note: 'Requires TikTok Developer app approval (free)',
    envKey: 'TIKTOK_CLIENT_KEY',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📸',
    color: '#E1306C',
    bg: '#FEF0F6',
    note: 'Connected via Facebook — link Instagram to your Facebook Page first',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '👥',
    color: '#1877F2',
    bg: '#EEF4FE',
    note: 'Posts to your Facebook Page — also links Instagram',
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    icon: '✖',
    color: '#000000',
    bg: '#F0F0F0',
    note: 'Requires Twitter API Basic tier (~$100/mo) for media upload',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶',
    color: '#FF0000',
    bg: '#FEF0F0',
    note: 'Uses same Google credentials as Drive',
  },
];

export default function SocialAccountsPanel() {
  const [status,      setStatus]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [disconnecting, setDisconnecting] = useState({});
  const [notice, setNotice]           = useState('');

  const [showGuide, setShowGuide]     = useState(false);

  useEffect(() => {
    // Check for ?social=xxx&status=connected in URL on return from OAuth
    const params = new URLSearchParams(window.location.search);
    const social = params.get('social');
    const s      = params.get('status');
    if (social && s) {
      setNotice(`${social} ${s === 'connected' ? 'connected successfully ✅' : 'connection failed ❌'}`);
      // Clean URL
      window.history.replaceState({}, '', '/admin/settings');
    }

    api.get('/social/status')
      .then(({ data }) => setStatus(data.status))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (platformId) => {
    try {
      const { data } = await api.get(`/social/${platformId}/connect-url`);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert(err.response?.data?.error || `Could not connect to ${platformId}. Ensure credentials are configured in Render environment variables.`);
    }
  };

  const handleDisconnect = async (platformId) => {
    if (!confirm(`Disconnect ${platformId}?`)) return;
    setDisconnecting(d => ({ ...d, [platformId]: true }));
    try {
      await api.post(`/social/${platformId}/disconnect`);
      setStatus(s => ({ ...s, [platformId]: false }));
    } catch (err) {
      alert(err.response?.data?.error || 'Disconnect failed.');
    } finally {
      setDisconnecting(d => ({ ...d, [platformId]: false }));
    }
  };

  if (loading) return <div style={{ padding: 20 }}><span className="spinner" /></div>;

  return (
    <div>
      {notice && (
        <div className={`alert ${notice.includes('✅') ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: 16 }}>
          {notice}
          <button onClick={() => setNotice('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLATFORMS.map(p => {
          const connected = status[p.id];
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 12,
              border: `1px solid ${connected ? p.color + '55' : 'var(--border)'}`,
              background: connected ? p.bg : 'var(--surface)',
              transition: 'border-color 0.15s',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: p.color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 20, flexShrink: 0,
                color: '#fff',
              }}>
                {p.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{p.note}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {connected ? (
                  <>
                    <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>✓ Connected</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, color: 'var(--red)' }}
                      onClick={() => handleDisconnect(p.id)}
                      disabled={disconnecting[p.id]}
                    >
                      {disconnecting[p.id] ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Disconnect'}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-sm"
                    style={{ background: p.color, color: '#fff', border: 'none', minWidth: 90 }}
                    onClick={() => handleConnect(p.id)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowGuide(!showGuide)}
          style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {showGuide ? '▼ Hide Social Setup Guide' : '▶ How to configure TikTok, YouTube & Instagram'}
        </button>

        {showGuide && (
          <div style={{
            marginTop: 10,
            padding: 16,
            borderRadius: 12,
            background: 'var(--surface-2, #f8f9fc)',
            border: '1px solid var(--border)',
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Social Platform Credentials Setup</h4>
            <div style={{ marginBottom: 12 }}>
              <strong>1. YouTube (Shorts & Videos):</strong>
              <div>Uses your existing Google Cloud project. Enable <em>YouTube Data API v3</em> in Google Cloud console. Add scope <code>https://www.googleapis.com/auth/youtube.upload</code>. Required in Render env: <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>.</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>2. Instagram & Facebook (Reels & Feed):</strong>
              <div>Create a Meta Developer app at developers.facebook.com. Link your Instagram Professional account to a Facebook Page. Required in Render env: <code>FACEBOOK_APP_ID</code> and <code>FACEBOOK_APP_SECRET</code>.</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>3. TikTok:</strong>
              <div>Create a TikTok Developer app at developers.tiktok.com and request Content Posting API approval. Required in Render env: <code>TIKTOK_CLIENT_KEY</code> and <code>TIKTOK_CLIENT_SECRET</code>.</div>
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
              OAuth Redirect URI for all platforms: <code>https://eventify-server-ogku.onrender.com/api/social/[platform]/callback</code>
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.5 }}>
        Instagram is automatically connected when you connect Facebook (if your Instagram is linked to a Facebook Page).
      </p>
    </div>
  );
}
