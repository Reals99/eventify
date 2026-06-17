import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLoader from './components/AppLoader';

// Auth
import AdminLogin from './pages/AdminLogin';
import AdminSetup from './pages/AdminSetup';

// Admin (protected)
import AdminDashboard from './pages/AdminDashboard';
import AdminSettings from './pages/AdminSettings';
import CreateEvent from './pages/CreateEvent';
import AdminReview from './pages/AdminReview';
import EventDetail from './pages/EventDetail';

// Guest kiosk
import KioskPage from './pages/KioskPage';

/**
 * FirstRunGate — redirects to /admin/setup automatically on first boot
 * before any routes render. Sits inside AuthProvider so it can read context.
 */
function FirstRunGate({ children }) {
  const { loading, isFirstRun } = useAuth();
  if (loading) return <AppLoader />;
  if (isFirstRun) return <Navigate to="/admin/setup" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FirstRunGate>
          <Routes>
            {/* ── Public ──────────────────────────────────────────── */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/setup" element={<AdminSetup />} />

            {/* ── Guest kiosk ─────────────────────────────────────── */}
            <Route path="/kiosk/:slug" element={<KioskPage />} />

            {/* ── Admin (protected) ───────────────────────────────── */}
            <Route path="/admin" element={
              <ProtectedRoute><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute><AdminSettings /></ProtectedRoute>
            } />
            <Route path="/admin/events/new" element={
              <ProtectedRoute><CreateEvent /></ProtectedRoute>
            } />
            <Route path="/admin/events/:id" element={
              <ProtectedRoute><EventDetail /></ProtectedRoute>
            } />
            <Route path="/admin/events/:id/edit" element={
              <ProtectedRoute><CreateEvent /></ProtectedRoute>
            } />
            <Route path="/admin/events/:id/review" element={
              <ProtectedRoute><AdminReview /></ProtectedRoute>
            } />

            {/* ── 404 ─────────────────────────────────────────────── */}
            <Route path="*" element={
              <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexDirection: 'column', gap: 16,
              }}>
                <div style={{ fontSize: 56 }}>🔍</div>
                <h1 style={{ fontSize: '2rem' }}>404</h1>
                <p>Page not found.</p>
                <a href="/admin" className="btn btn-primary">Go to dashboard</a>
              </div>
            } />
          </Routes>
        </FirstRunGate>
      </BrowserRouter>
    </AuthProvider>
  );
}
