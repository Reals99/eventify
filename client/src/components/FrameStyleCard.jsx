// Visual card showing what each frame overlay looks like on a video thumbnail

export default function FrameStyleCard({ style, selected, onSelect, primaryColor, eventName }) {
  const color = primaryColor || '#7F77DD';

  // Mini video mockup per style
  const renderOverlay = () => {
    switch (style.id) {
      case 'minimal':
        return (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '5px 8px',
            background: 'rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontSize: 8, color: '#fff', fontWeight: 600 }}>{eventName || 'Event Name'}</div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Guest Name</div>
          </div>
        );
      case 'bold':
        return (
          <>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '5px 8px', background: color,
            }}>
              <div style={{ fontSize: 8, color: '#fff', fontWeight: 700, textAlign: 'center' }}>
                {eventName || 'Event Name'}
              </div>
            </div>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '4px 8px', background: color + 'CC',
            }}>
              <div style={{ fontSize: 7, color: '#fff', textAlign: 'center' }}>Guest Name</div>
            </div>
          </>
        );
      case 'elegant':
        return (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '6px 8px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            borderBottom: `2px solid ${color}`,
          }}>
            <div style={{ fontSize: 9, color: '#fff', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              {eventName || 'Event Name'}
            </div>
            <div style={{ fontSize: 7, color: color, fontFamily: 'Georgia, serif' }}>Guest Name</div>
          </div>
        );
      case 'neon':
        return (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '5px 8px', background: 'rgba(0,0,0,0.8)',
          }}>
            <div style={{
              fontSize: 8, color: color, fontWeight: 700,
              textShadow: `0 0 6px ${color}, 0 0 12px ${color}`,
            }}>
              {eventName || 'Event Name'}
            </div>
            <div style={{ fontSize: 7, color: '#fff', opacity: 0.8 }}>Guest Name</div>
          </div>
        );
      case 'classic':
        return (
          <div style={{
            position: 'absolute', bottom: 8, left: 0,
            padding: '4px 10px 4px 8px',
            background: color,
            clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0 100%)',
          }}>
            <div style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>
              {eventName || 'Event Name'}
            </div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.85)' }}>Guest Name</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      onClick={() => onSelect(style.id)}
      style={{
        cursor: 'pointer',
        border: selected ? `2px solid ${color}` : '1.5px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: selected ? 'var(--ev-secondary)' : 'var(--surface)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? `0 0 0 3px ${color}22` : 'none',
      }}
    >
      {/* Mini video preview */}
      <div style={{
        height: 80, background: '#2a2a3e',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Fake video content */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>
        {renderOverlay()}
      </div>

      {/* Label */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: selected ? color : 'var(--text-1)',
        }}>
          {style.label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
          {style.description}
        </div>
      </div>
    </div>
  );
}
