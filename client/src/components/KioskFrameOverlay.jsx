import React from 'react';

/**
 * KioskFrameOverlay
 * Live visual overlay rendered directly over the camera video stream
 * on the Kiosk recording screen. Matches the canvas video compositor.
 */
export default function KioskFrameOverlay({ frame, theme, eventName, guestName, eventDate }) {
  if (!frame || frame.enabled === false) return null;

  const style = frame.style || 'minimal';
  const primary = theme?.primaryColor || '#7F77DD';
  const title = eventName || 'Event Title';
  const guest = guestName || 'Guest';
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const showTitle = frame.showEventTitle !== false;
  const showGuest = frame.showGuestName !== false;
  const showDate = Boolean(frame.showDate && formattedDate);
  const showLogo = Boolean(frame.showLogo && frame.logoUrl);

  return (
    <div
      className="kiosk-frame-overlay-container"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* ── 1. MINIMAL ────────────────────────────────────────────────── */}
      {style === 'minimal' && (
        <div style={{ marginTop: 'auto', width: '100%' }}>
          <div
            style={{
              background: 'rgba(10, 10, 18, 0.72)',
              backdropFilter: 'blur(8px)',
              borderTop: `3px solid ${primary}`,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {showLogo && (
                <img
                  src={frame.logoUrl}
                  alt="Event logo"
                  style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 4 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                {showTitle && (
                  <div
                    style={{
                      fontSize: 'clamp(13px, 2vw, 17px)',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {title}
                  </div>
                )}
                {showGuest && (
                  <div
                    style={{
                      fontSize: 'clamp(11px, 1.5vw, 13px)',
                      fontWeight: 600,
                      color: primary,
                      marginTop: 1,
                    }}
                  >
                    {guest}
                  </div>
                )}
              </div>
            </div>
            {showDate && (
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.7)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {formattedDate}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. BOLD ───────────────────────────────────────────────────── */}
      {style === 'bold' && (
        <>
          {/* Top Banner */}
          <div
            style={{
              background: primary,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {showLogo && (
                <img
                  src={frame.logoUrl}
                  alt="Logo"
                  style={{ width: 28, height: 28, objectFit: 'contain' }}
                />
              )}
              {showTitle && (
                <div
                  style={{
                    fontSize: 'clamp(14px, 2vw, 18px)',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {title}
                </div>
              )}
            </div>
            {showDate && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                {formattedDate}
              </div>
            )}
          </div>

          {/* Bottom Banner */}
          <div
            style={{
              marginTop: 'auto',
              background: 'rgba(15, 15, 25, 0.92)',
              borderTop: `3px solid ${primary}`,
              padding: '8px 16px',
              textAlign: 'center',
            }}
          >
            {showGuest && (
              <div
                style={{
                  fontSize: 'clamp(13px, 1.8vw, 16px)',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}
              >
                {guest}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 3. ELEGANT ────────────────────────────────────────────────── */}
      {style === 'elegant' && (
        <div style={{ marginTop: 'auto', width: '100%' }}>
          <div
            style={{
              background: 'linear-gradient(to top, rgba(10, 10, 18, 0.94) 0%, rgba(10, 10, 18, 0.6) 55%, transparent 100%)',
              padding: '32px 20px 14px',
              textAlign: 'center',
            }}
          >
            {showTitle && (
              <div
                style={{
                  fontSize: 'clamp(16px, 2.5vw, 22px)',
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: 'italic',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  marginBottom: 6,
                }}
              >
                {title}
              </div>
            )}
            <div
              style={{
                width: '60%',
                height: 2,
                background: primary,
                margin: '0 auto 8px',
                borderRadius: 2,
              }}
            />
            {showGuest && (
              <div
                style={{
                  fontSize: 'clamp(12px, 1.6vw, 15px)',
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: 'italic',
                  color: primary,
                  fontWeight: 500,
                }}
              >
                {guest}
              </div>
            )}
            {showDate && (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: 4,
                  fontFamily: 'Georgia, serif',
                }}
              >
                {formattedDate}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. NEON ───────────────────────────────────────────────────── */}
      {style === 'neon' && (
        <div
          style={{
            position: 'absolute',
            inset: 12,
            border: `2px solid ${primary}`,
            boxShadow: `0 0 12px ${primary}88, inset 0 0 12px ${primary}44`,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderTop: `4px solid ${primary}`,
                borderLeft: `4px solid ${primary}`,
              }}
            />
            <div
              style={{
                width: 14,
                height: 14,
                borderTop: `4px solid ${primary}`,
                borderRight: `4px solid ${primary}`,
              }}
            />
          </div>

          <div
            style={{
              background: 'rgba(8, 8, 16, 0.85)',
              borderRadius: 6,
              padding: '10px 14px',
              border: `1px solid ${primary}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {showTitle && (
                <div
                  style={{
                    fontSize: 'clamp(13px, 1.8vw, 16px)',
                    fontWeight: 800,
                    color: primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    textShadow: `0 0 8px ${primary}`,
                  }}
                >
                  {title}
                </div>
              )}
              {showGuest && (
                <div
                  style={{
                    fontSize: 'clamp(11px, 1.4vw, 13px)',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    marginTop: 2,
                  }}
                >
                  {guest}
                </div>
              )}
            </div>
            {showDate && (
              <div
                style={{
                  fontSize: 11,
                  color: primary,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              >
                {formattedDate}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. CLASSIC ────────────────────────────────────────────────── */}
      {style === 'classic' && (
        <div style={{ marginTop: 'auto', paddingBottom: 16 }}>
          <div
            style={{
              background: primary,
              clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0 100%)',
              padding: '6px 28px 6px 16px',
              maxWidth: '75%',
              display: 'inline-block',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {showTitle && (
              <div
                style={{
                  fontSize: 'clamp(13px, 1.8vw, 17px)',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}
              >
                {title}
              </div>
            )}
          </div>
          <div
            style={{
              background: 'rgba(15, 15, 25, 0.92)',
              clipPath: 'polygon(0 0, 95% 0, 90% 100%, 0 100%)',
              padding: '4px 24px 4px 16px',
              maxWidth: '65%',
              marginTop: 1,
            }}
          >
            {showGuest && (
              <div
                style={{
                  fontSize: 'clamp(11px, 1.4vw, 13px)',
                  fontWeight: 600,
                  color: '#FFFFFF',
                }}
              >
                {guest}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
