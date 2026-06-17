import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--ev-primary)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>Eventify</h1>
          <p style={{ fontSize: 14 }}>Admin dashboard</p>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 24 }}>Sign in</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@example.com"
                required
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
            First time?{' '}
            <Link to="/admin/setup" style={{ color: 'var(--ev-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Create your admin account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
