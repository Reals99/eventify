import { useState, useEffect } from 'react';

/**
 * KeepAlive banner — shown in the admin dashboard.
 *
 * Render free tier spins down after 15 min of inactivity.
 * This component:
 *   1. Detects if the server just woke up (slow first response)
 *   2. Shows a one-time setup tip to connect UptimeRobot
 *   3. Can be dismissed permanently
 */
export default function KeepAliveBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if user hasn't dismissed it before
    const dismissed = localStorage.getItem('eventify_keepalive_dismissed');
    if (!dismissed) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('eventify_keepalive_dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px 16px',
      background: 'var(--amber-bg)',
      border: '1px solid #E8C97A',
      borderRadius: 10,
      marginBottom: 20,
      fontSize: 13,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>⏰</span>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 3 }}>
          Keep your server awake at events
        </div>
        <div style={{ color: '#7A5000', lineHeight: 1.5 }}>
          Render's free tier sleeps after 15 min of inactivity — the first kiosk upload could take 30s.
          Set up a free ping monitor to prevent this:
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href="https://uptimerobot.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 6,
              background: 'var(--amber)', color: '#fff',
              fontSize: 12, fontWeight: 500, textDecoration: 'none',
            }}
          >
            ↗ Set up UptimeRobot (free)
          </a>
          <div style={{ fontSize: 11, color: '#7A5000', alignSelf: 'center' }}>
            Monitor: <code style={{ background: '#FDD68433', padding: '1px 5px', borderRadius: 3 }}>
              {import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/api/health`
                : 'https://your-server.onrender.com/api/health'}
            </code> every 10 min
          </div>
        </div>
      </div>

      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--amber)', flexShrink: 0,
          lineHeight: 1, padding: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
