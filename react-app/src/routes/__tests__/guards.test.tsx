/**
 * Frontend route/access smoke tests (Task 13).
 *
 * The guards are rendered with the real react-router `Navigate` so the
 * redirect wiring is exercised, while `useAuth` is replaced with a fixed
 * session state for each case.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

type UserType = 'customer' | 'admin' | null;

const authState: { isAuthenticated: boolean; userType: UserType } = {
  isAuthenticated: false,
  userType: null,
};

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { AdminProtectedRoute, AuthenticatedRoute, CustomerProtectedRoute, GuestRoute } from '../guards';

const CHILD = 'protected-content';

function render(guard: ReactNode, path = '/protected'): string {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={guard} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.isAuthenticated = false;
  authState.userType = null;
});

describe('AdminProtectedRoute', () => {
  it('hides admin content from guests', () => {
    expect(render(<AdminProtectedRoute>{CHILD}</AdminProtectedRoute>)).not.toContain(CHILD);
  });

  it('hides admin content from customers', () => {
    authState.isAuthenticated = true;
    authState.userType = 'customer';

    expect(render(<AdminProtectedRoute>{CHILD}</AdminProtectedRoute>)).not.toContain(CHILD);
  });

  it('renders admin content for an authenticated admin', () => {
    authState.isAuthenticated = true;
    authState.userType = 'admin';

    expect(render(<AdminProtectedRoute>{CHILD}</AdminProtectedRoute>)).toContain(CHILD);
  });
});

describe('CustomerProtectedRoute', () => {
  it('hides customer content from guests and admins', () => {
    expect(render(<CustomerProtectedRoute>{CHILD}</CustomerProtectedRoute>)).not.toContain(CHILD);

    authState.isAuthenticated = true;
    authState.userType = 'admin';

    expect(render(<CustomerProtectedRoute>{CHILD}</CustomerProtectedRoute>)).not.toContain(CHILD);
  });

  it('renders customer content for an authenticated customer', () => {
    authState.isAuthenticated = true;
    authState.userType = 'customer';

    expect(render(<CustomerProtectedRoute>{CHILD}</CustomerProtectedRoute>)).toContain(CHILD);
  });
});

describe('AuthenticatedRoute', () => {
  it('allows either role and rejects guests', () => {
    expect(render(<AuthenticatedRoute>{CHILD}</AuthenticatedRoute>)).not.toContain(CHILD);

    authState.isAuthenticated = true;
    authState.userType = 'admin';
    expect(render(<AuthenticatedRoute>{CHILD}</AuthenticatedRoute>)).toContain(CHILD);

    authState.userType = 'customer';
    expect(render(<AuthenticatedRoute>{CHILD}</AuthenticatedRoute>)).toContain(CHILD);
  });
});

describe('GuestRoute', () => {
  it('renders auth pages for guests', () => {
    expect(
      render(
        <GuestRoute redirectPath="/dashboard">{CHILD}</GuestRoute>,
        '/login',
      ),
    ).toContain(CHILD);
  });

  it('hides auth pages from an already-authenticated visitor', () => {
    authState.isAuthenticated = true;
    authState.userType = 'customer';

    expect(
      render(
        <GuestRoute redirectPath="/dashboard">{CHILD}</GuestRoute>,
        '/login',
      ),
    ).not.toContain(CHILD);
  });
});
