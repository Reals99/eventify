// Shown over the video preview while FFmpeg is processing

export default function ProcessingSpinner({ primaryColor }) {
  const color = primaryColor || '#7F77DD';
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(10,10,20,0.78)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, borderRadius: 12, zIndex: 10,
    }}>
      {/* Spinning ring */}
      <div style={{
        width: 52, height: 52,
        border: `4px solid ${color}33`,
        borderTop: `4px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.85s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Applying frame overlay…
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          FFmpeg is processing · this may take up to 60s
        </div>
      </div>
    </div>
  );
}
