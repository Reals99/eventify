import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import DriveStatus from '../components/DriveStatus';
import KeepAliveBanner from '../components/KeepAliveBanner';
const STATUS_COLORS = {
  active:   { bg: 'var(--green-bg)',  text: 'var(--green)'  },
  draft:    { bg: 'var(--bg)',        text: 'var(--text-3)'  },
  ended:    { bg: 'var(--amber-bg)',  text: 'var(--amber)'  },
  archived: { bg: '#F0F0F0',          text: '#777'          },
};

export default function AdminDashboard() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/events')
      .then(({ data }) => setEvents(data.events))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? events : events.filter(e => e.status === filter);

  const handleStatusChange = async (id, status) => {
    try {
      const { data } = await api.patch(`/events/${id}/status`, { status });
      setEvents(ev => ev.map(e => e._id === id ? data.event : e));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try {
      await api.delete(`/events/${id}`);
      setEvents(ev => ev.filter(e => e._id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Top nav ──────────────────────────────────────────────────── */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--ev-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Eventify</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DriveStatus />
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            👋 {admin?.name}
          </span>
          <Link to="/admin/settings" className="btn btn-ghost btn-sm">Settings</Link>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <KeepAliveBanner />

        {/* ── Header row ─────────────────────────────────────────────── */}
        <div className="flex-between" style={{ marginBottom: 28 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>Events</h1>
            <p style={{ fontSize: 14 }}>{events.length} event{events.length !== 1 ? 's' : ''} total</p>
          </div>
          <Link to="/admin/events/new" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New event
          </Link>
        </div>

        {/* ── Filter tabs ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {['all', 'active', 'draft', 'ended'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="btn btn-sm"
              style={{
                background: filter === f ? 'var(--ev-primary)' : 'var(--surface)',
                color: filter === f ? '#fff' : 'var(--text-2)',
                border: `0.5px solid ${filter === f ? 'var(--ev-primary)' : 'var(--border)'}`,
                textTransform: 'capitalize',
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* ── Events list ────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex-center" style={{ height: 200 }}>
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎪</div>
            <h3 style={{ marginBottom: 8 }}>No events yet</h3>
            <p style={{ fontSize: 14, marginBottom: 24 }}>Create your first event to get started.</p>
            <Link to="/admin/events/new" className="btn btn-primary">Create event</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(ev => (
              <EventCard
                key={ev._id}
                event={ev}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event: ev, onStatusChange, onDelete }) {
  const navigate = useNavigate();
  const sc = STATUS_COLORS[ev.status] || STATUS_COLORS.draft;

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {/* Color swatch */}
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: ev.theme?.primaryColor || 'var(--ev-primary)',
              flexShrink: 0,
            }} />
            <h3 style={{ margin: 0, cursor: 'pointer', color: 'var(--text-1)' }}
              onClick={() => navigate(`/admin/events/${ev._id}`)}>
              {ev.name}
            </h3>
            <span style={{
              fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 500,
              background: sc.bg, color: sc.text, textTransform: 'capitalize',
            }}>
              {ev.status}
            </span>
          </div>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {ev.location ? ` · ${ev.location}` : ''}
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              ['🎬', ev.stats?.totalRecordings || 0, 'recordings'],
              ['✅', ev.stats?.approvedCount || 0, 'approved'],
              ['🚩', ev.stats?.flaggedCount || 0, 'flagged'],
              ['📤', ev.stats?.publishedCount || 0, 'published'],
            ].map(([icon, n, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{icon} {label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {/* Kiosk link */}
          <a
            href={`/kiosk/${ev.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
          >
            🖥 Kiosk
          </a>

          <button className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/admin/events/${ev._id}/review`)}>
            Review
          </button>

          <button className="btn btn-outline btn-sm"
            onClick={() => navigate(`/admin/events/${ev._id}/edit`)}>
            Edit
          </button>

          {/* Quick status toggle */}
          {ev.status === 'draft' && (
            <button className="btn btn-success btn-sm"
              onClick={() => onStatusChange(ev._id, 'active')}>
              Activate
            </button>
          )}
          {ev.status === 'active' && (
            <button className="btn btn-sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: 'none' }}
              onClick={() => onStatusChange(ev._id, 'ended')}>
              End event
            </button>
          )}

          <button className="btn btn-sm"
            style={{ background: 'var(--red-bg)', color: 'var(--red)', border: 'none' }}
            onClick={() => onDelete(ev._id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
