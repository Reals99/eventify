import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Small indicator shown in the admin nav bar.
 * Green = Drive connected, Amber = not connected, click to connect.
 */
export default function DriveStatus() {
  const [connected, setConnected] = useState(null); // null = loading

  useEffect(() => {
    api.get('/auth/drive-status')
      .then(({ data }) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) return null;

  if (connected) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 20,
        background: 'var(--green-bg)', border: '0.5px solid #a3d9c3',
        fontSize: 12, fontWeight: 500, color: 'var(--green)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
        Drive connected
      </div>
    );
  }

  const handleConnect = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.get('/auth/google/url');
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Google Drive is not configured on the server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.');
    }
  };

  return (
    <button
      onClick={handleConnect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 20,
        background: 'var(--amber-bg)', border: '0.5px solid #e8c97a',
        fontSize: 12, fontWeight: 500, color: 'var(--amber)',
        textDecoration: 'none', cursor: 'pointer',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
      Connect Drive
    </button>
  );
}
