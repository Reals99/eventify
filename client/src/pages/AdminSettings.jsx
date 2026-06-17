import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SocialAccountsPanel from '../components/SocialAccountsPanel';

export default function AdminSettings() {
  const { admin } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [inviteMsg, setInviteMsg] = useState(null);
  const [loading, setLoading] = useState({ pw: false, invite: false });

  const handlePw = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return setPwMsg({ type: 'error', text: 'Passwords do not match.' });
    setLoading(l => ({ ...l, pw: true }));
    try {
      await api.patch('/auth/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg({ type: 'success', text: 'Password updated successfully.' });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed.' });
    } finally {
      setLoading(l => ({ ...l, pw: false }));
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setLoading(l => ({ ...l, invite: true }));
    try {
      await api.post('/auth/invite', inviteForm);
      setInviteMsg({ type: 'success', text: `Admin account created for ${inviteForm.email}.` });
      setInviteForm({ name: '', email: '', password: '' });
    } catch (err) {
      setInviteMsg({ type: 'error', text: err.response?.data?.error || 'Failed.' });
    } finally {
      setLoading(l => ({ ...l, invite: false }));
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link to="/admin" style={{ textDecoration: 'none' }}>
          <button className="btn btn-ghost btn-sm">← Dashboard</button>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Settings</span>
      </nav>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 640 }}>
        {/* Profile info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 16 }}>Account</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--ev-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#fff', fontWeight: 700, flexShrink: 0,
            }}>
              {admin?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{admin?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{admin?.email}</div>
              <span style={{
                display: 'inline-block', marginTop: 4, fontSize: 11, padding: '2px 8px',
                background: 'var(--ev-secondary)', color: 'var(--ev-accent)',
                borderRadius: 20, fontWeight: 500, textTransform: 'capitalize',
              }}>
                {admin?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 16 }}>Change password</h2>
          {pwMsg && <div className={`alert alert-${pwMsg.type}`}>{pwMsg.text}</div>}
          <form onSubmit={handlePw}>
            {[
              ['currentPassword', 'Current password', 'Current password'],
              ['newPassword', 'New password', 'Min. 8 characters'],
              ['confirm', 'Confirm new password', 'Repeat new password'],
            ].map(([field, label, placeholder]) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label>{label}</label>
                <input type="password" value={pwForm[field]}
                  onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder} required />
              </div>
            ))}
            <button className="btn btn-primary" type="submit" disabled={loading.pw}>
              {loading.pw ? <span className="spinner" /> : 'Update password'}
            </button>
          </form>
        </div>

        {/* Invite admin — superadmin only */}
        {admin?.role === 'superadmin' && (
          <div className="card">
            <h2 style={{ marginBottom: 6 }}>Invite admin</h2>
            <p style={{ fontSize: 13, marginBottom: 16 }}>Create a new admin account for your team.</p>
            {inviteMsg && <div className={`alert alert-${inviteMsg.type}`}>{inviteMsg.text}</div>}
            <form onSubmit={handleInvite}>
              {[
                ['name', 'Full name', 'text', 'Ama Owusu'],
                ['email', 'Email', 'email', 'ama@example.com'],
                ['password', 'Temporary password', 'password', 'Min. 8 characters'],
              ].map(([field, label, type, placeholder]) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <label>{label}</label>
                  <input type={type} value={inviteForm[field]}
                    onChange={e => setInviteForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder} required />
                </div>
              ))}
              <button className="btn btn-primary" type="submit" disabled={loading.invite}>
                {loading.invite ? <span className="spinner" /> : 'Create admin account'}
              </button>
            </form>
          </div>
        )}
        {/* Social accounts */}
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 6 }}>Social accounts</h2>
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            Connect platforms to enable one-click publishing from the review screen.
          </p>
          <SocialAccountsPanel />
        </div>

      </div>
    </div>
  );
}
