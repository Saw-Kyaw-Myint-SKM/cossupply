import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

/**
 * Route guards shared by the SPA router (Task 13 smoke tests import these).
 *
 * Each guard is a thin wrapper around the live auth context so the redirect
 * rules can be exercised without booting the whole application.
 */

export function CustomerProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, userType } = useAuth();

  if (!isAuthenticated || userType !== 'customer') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, userType } = useAuth();

  if (!isAuthenticated || userType !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

/** Customer or Admin: the notifications page is shared by both roles. */
export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Auth pages redirect an already-authenticated visitor to their home page. */
export function GuestRoute({
  children,
  redirectPath,
}: {
  children: ReactNode;
  redirectPath: string;
}) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
