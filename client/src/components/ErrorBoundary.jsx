import { Component } from 'react';

/**
 * ErrorBoundary — wraps the whole app.
 * Catches unhandled React render errors and shows a friendly recovery screen
 * instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isKiosk = window.location.pathname.startsWith('/kiosk');

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        padding: 32,
        background: isKiosk ? '#1a1a2e' : 'var(--bg)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 56 }}>{isKiosk ? '📵' : '⚠️'}</div>

        <div>
          <h2 style={{ color: isKiosk ? '#fff' : 'var(--text-1)', marginBottom: 8 }}>
            {isKiosk ? 'Something went wrong' : 'Unexpected error'}
          </h2>
          <p style={{ color: isKiosk ? 'rgba(255,255,255,0.6)' : 'var(--text-2)', fontSize: 14, maxWidth: 400, lineHeight: 1.6 }}>
            {isKiosk
              ? 'Please ask a staff member to refresh the kiosk.'
              : 'An unexpected error occurred. Reload the page to continue.'}
          </p>
        </div>

        {/* Show error details in dev */}
        {import.meta.env.DEV && this.state.error && (
          <pre style={{
            fontSize: 11, color: '#E24B4A',
            background: '#1a1a1a', padding: '12px 16px',
            borderRadius: 8, maxWidth: 600,
            overflow: 'auto', textAlign: 'left',
            maxHeight: 200,
          }}>
            {this.state.error.toString()}
          </pre>
        )}

        <button
          onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.href = isKiosk ? window.location.pathname : '/admin';
          }}
          style={{
            padding: '12px 28px',
            borderRadius: 10,
            border: 'none',
            background: '#7F77DD',
            color: '#fff',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {isKiosk ? 'Tap to restart' : 'Reload app'}
        </button>
      </div>
    );
  }
}
