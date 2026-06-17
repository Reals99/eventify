// Compact video card shown in the review list sidebar

export default function VideoCard({ video, selected, onClick, primaryColor }) {
  const color = primaryColor || '#7F77DD';

  const STATUS_STYLE = {
    pending:  { bg: '#FAEEDA', text: '#BA7517' },
    approved: { bg: '#E1F5EE', text: '#1D9E75' },
    flagged:  { bg: '#FCEBEB', text: '#E24B4A' },
  };
  const ss = STATUS_STYLE[video.status] || STATUS_STYLE.pending;

  const dur = video.cloudinary?.duration
    ? `${Math.floor(video.cloudinary.duration / 60)}:${String(Math.round(video.cloudinary.duration % 60)).padStart(2,'0')}`
    : '—';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        cursor: 'pointer',
        border: selected ? `2px solid ${color}` : '1.5px solid var(--border)',
        background: selected ? `${color}0D` : 'var(--surface)',
        transition: 'border-color 0.15s, background 0.15s',
        marginBottom: 8,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {video.guestName || 'Anonymous'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {video.phase === 'expectation' ? '✨ Before' : '🏁 After'} · {video.recordingType === 'video' ? '🎥' : '🎙️'} · {dur}
          </div>
        </div>
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
          background: ss.bg, color: ss.text, flexShrink: 0, marginLeft: 8,
          textTransform: 'capitalize',
        }}>
          {video.status}
        </span>
      </div>

      {/* Drive indicator */}
      {video.drive?.uploaded && (
        <div style={{ fontSize: 10, color: '#1D9E75', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
          On Drive
        </div>
      )}

      {/* Processed indicator */}
      {video.processed?.framed?.url && (
        <div style={{ fontSize: 10, color: color, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
          ✓ Frame ready
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
        {new Date(video.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
