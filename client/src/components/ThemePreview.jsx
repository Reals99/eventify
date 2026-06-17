// Shows a live mini-preview of the kiosk screen with the current theme applied

export default function ThemePreview({ theme, eventName, frameStyle }) {
  const primary = theme?.primaryColor || '#7F77DD';
  const secondary = theme?.secondaryColor || '#EEEDFE';
  const accent = theme?.accentColor || '#3C3489';

  return (
    <div style={{
      width: '100%',
      maxWidth: 240,
      margin: '0 auto',
      userSelect: 'none',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 8 }}>
        Kiosk preview
      </p>

      {/* Phone/tablet frame */}
      <div style={{
        border: '3px solid #1A1A2E',
        borderRadius: 20,
        overflow: 'hidden',
        background: secondary,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}>
        {/* Status bar */}
        <div style={{ background: primary, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff', opacity: 0.8 }}>Eventify</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 12px 20px', textAlign: 'center', background: secondary }}>
          {/* Event badge */}
          <div style={{
            display: 'inline-block', fontSize: 8, padding: '2px 8px',
            background: primary, color: '#fff',
            borderRadius: 20, marginBottom: 8, fontWeight: 600,
          }}>
            LIVE
          </div>

          {/* Event name */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: accent,
            marginBottom: 12, lineHeight: 1.3,
          }}>
            {eventName || 'Your Event Name'}
          </div>

          {/* Big record button */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: primary, margin: '0 auto 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 0 8px ${primary}33`,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>

          <div style={{ fontSize: 8, color: accent, opacity: 0.7 }}>Tap to record</div>

          {/* Frame style indicator */}
          {frameStyle && frameStyle !== 'none' && (
            <div style={{
              marginTop: 10,
              background: primary,
              borderRadius: 4,
              padding: '4px 6px',
            }}>
              <div style={{ fontSize: 8, color: '#fff', opacity: 0.9, fontWeight: 600 }}>
                {frameStyle.toUpperCase()} FRAME
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav hint */}
        <div style={{
          background: primary, padding: '6px 12px',
          display: 'flex', justifyContent: 'center', gap: 12,
        }}>
          {['Before', 'After'].map(label => (
            <div key={label} style={{
              fontSize: 8, color: '#fff', opacity: 0.8,
              padding: '2px 8px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.3)',
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
