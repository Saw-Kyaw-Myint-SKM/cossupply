import { Navigate, Outlet, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  /** Whether authentication is required */
  isAuthenticated: boolean;
  /** Role required to access (optional) */
  requiredRole?: 'customer' | 'admin';
  /** Current user role */
  userRole?: 'customer' | 'admin' | null;
  /** Where to redirect if not authenticated */
  redirectPath?: string;
}

/**
 * Protected Route Component
 * 
 * Guards routes that require authentication or specific roles.
 */
export function ProtectedRoute({
  isAuthenticated,
  requiredRole,
  userRole,
  redirectPath = '/login',
}: ProtectedRouteProps) {
  const location = useLocation();

  // Not authenticated
  if (!isAuthenticated) {
    // Store the attempted URL for redirect after login
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Role check if required
  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    const fallbackPath = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
