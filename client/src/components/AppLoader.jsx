/**
 * Full-screen loading splash shown while the app checks
 * the stored JWT token on first load. Prevents flash of login screen.
 */
export default function AppLoader() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      background: 'var(--bg)',
      zIndex: 9999,
    }}>
      {/* Logo mark */}
      <div style={{
        width: 64, height: 64,
        borderRadius: 18,
        background: '#7F77DD',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(127,119,221,0.35)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10 8 16 12 10 16 10 8"/>
        </svg>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          Eventify
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
          Loading…
        </div>
      </div>

      {/* Spinner */}
      <div style={{
        width: 24, height: 24,
        border: '2.5px solid #EEEDFE',
        borderTop: '2.5px solid #7F77DD',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
