import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLoader from './AppLoader';

export default function ProtectedRoute({ children }) {
  const { admin, loading, isFirstRun } = useAuth();

  // Show full-screen loader while JWT is being verified
  if (loading) return <AppLoader />;

  // First boot — no admins exist yet, go to setup
  if (isFirstRun) return <Navigate to="/admin/setup" replace />;

  // Not logged in — go to login
  if (!admin) return <Navigate to="/admin/login" replace />;

  return children;
}
