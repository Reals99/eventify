import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminSetup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'var(--ev-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>Eventify</h1>
          <p style={{ fontSize: 14 }}>Create your superadmin account</p>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 6 }}>First-time setup</h2>
          <p style={{ fontSize: 13, marginBottom: 24 }}>
            This page only works before any admin exists. After setup, new admins are invited by you.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="name">Full name</label>
              <input id="name" type="text" value={form.name} onChange={set('name')}
                placeholder="Kofi Mensah" required />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" value={form.email} onChange={set('email')}
                placeholder="admin@example.com" required />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={form.password} onChange={set('password')}
                placeholder="Min. 8 characters" required />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="confirm">Confirm password</label>
              <input id="confirm" type="password" value={form.confirm} onChange={set('confirm')}
                placeholder="Repeat password" required />
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
              style={{ width: '100%' }}>
              {loading ? <span className="spinner" /> : 'Create account & continue'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
            Already have an account?{' '}
            <Link to="/admin/login" style={{ color: 'var(--ev-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
