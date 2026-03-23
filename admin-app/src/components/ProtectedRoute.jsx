import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute({
  authReady,
  isAuthenticatedAdmin,
}) {
  const location = useLocation();

  if (!authReady) {
    return <div className="auth-loading">Checking admin access...</div>;
  }

  if (!isAuthenticatedAdmin) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
}
