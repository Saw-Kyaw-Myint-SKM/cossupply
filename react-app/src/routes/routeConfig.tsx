import { createBrowserRouter, Navigate } from 'react-router-dom';

// Lazy load pages
import { lazy, Suspense } from 'react';

// Public Pages
const HomePage = lazy(() => import('../features/products/pages/HomePage'));
const ProductListPage = lazy(() => import('../features/products/pages/ProductListPage'));
const ProductDetailPage = lazy(() => import('../features/products/pages/ProductDetailPage'));
const CategoryListPage = lazy(() => import('../features/products/pages/CategoryListPage'));
const CartPage = lazy(() => import('../features/cart/pages/CartPage'));

// Auth Pages
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage'));

// Customer Pages
const CustomerDashboardPage = lazy(() => import('../features/dashboard/pages/CustomerDashboardPage'));
const QuotationListPage = lazy(() => import('../features/quotations/pages/QuotationListPage'));
const QuotationDetailPage = lazy(() => import('../features/quotations/pages/QuotationDetailPage'));
const OrderListPage = lazy(() => import('../features/orders/pages/OrderListPage'));
const OrderDetailPage = lazy(() => import('../features/orders/pages/OrderDetailPage'));

// Admin Pages
const AdminLoginPage = lazy(() => import('../features/admin/pages/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage'));
const AdminSettingsPage = lazy(() => import('../features/admin/pages/AdminSettingsPage'));
const AdminCategoryListPage = lazy(() => import('../features/admin/pages/CategoryListPage'));
const CategoryFormPage = lazy(() => import('../features/admin/pages/CategoryFormPage'));
const SupplierListPage = lazy(() => import('../features/admin/pages/SupplierListPage'));
const SupplierFormPage = lazy(() => import('../features/admin/pages/SupplierFormPage'));
// The public pages claim `CategoryListPage`, `ProductListPage`, and
// `ProductDetailPage`, so the admin duplicates get an `Admin` prefix here.
const AdminProductListPage = lazy(() => import('../features/admin/pages/ProductListPage'));
const AdminProductFormPage = lazy(() => import('../features/admin/pages/ProductFormPage'));

// Layout
import { AppLayout } from '../components/layout/AppLayout';

// Auth context
import { useAuth } from '../lib/auth-context';

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Wrapper component for protected routes
function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userType } = useAuth();
  
  if (!isAuthenticated || userType !== 'customer') {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userType } = useAuth();
  
  if (!isAuthenticated || userType !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <>{children}</>;
}

// Wrapper for auth pages (redirect if already logged in)
function GuestRoute({ children, redirectPath }: { children: React.ReactNode; redirectPath: string }) {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }
  
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // Public Routes
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'products',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProductListPage />
          </Suspense>
        ),
      },
      {
        path: 'products/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProductDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'categories',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CategoryListPage />
          </Suspense>
        ),
      },
      {
        path: 'cart',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CartPage />
          </Suspense>
        ),
      },

      // Auth Routes (redirect if already authenticated)
      {
        path: 'login',
        element: (
          <GuestRoute redirectPath="/dashboard">
            <Suspense fallback={<PageLoader />}>
              <LoginPage />
            </Suspense>
          </GuestRoute>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestRoute redirectPath="/dashboard">
            <Suspense fallback={<PageLoader />}>
              <RegisterPage />
            </Suspense>
          </GuestRoute>
        ),
      },

      // Customer Protected Routes
      {
        path: 'dashboard',
        element: (
          <CustomerProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CustomerDashboardPage />
            </Suspense>
          </CustomerProtectedRoute>
        ),
      },
      {
        path: 'quotations',
        element: (
          <CustomerProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <QuotationListPage />
            </Suspense>
          </CustomerProtectedRoute>
        ),
      },
      {
        path: 'quotations/:id',
        element: (
          <CustomerProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <QuotationDetailPage />
            </Suspense>
          </CustomerProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <CustomerProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <OrderListPage />
            </Suspense>
          </CustomerProtectedRoute>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <CustomerProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <OrderDetailPage />
            </Suspense>
          </CustomerProtectedRoute>
        ),
      },

      // Admin Auth Route
      {
        path: 'admin/login',
        element: (
          <GuestRoute redirectPath="/admin/dashboard">
            <Suspense fallback={<PageLoader />}>
              <AdminLoginPage />
            </Suspense>
          </GuestRoute>
        ),
      },

      // Admin Protected Routes
      {
        path: 'admin/dashboard',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminDashboardPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminSettingsPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/categories',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminCategoryListPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/categories/new',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CategoryFormPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/categories/:id/edit',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CategoryFormPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/suppliers',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SupplierListPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/suppliers/new',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SupplierFormPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/suppliers/:id/edit',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SupplierFormPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/products',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminProductListPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/products/new',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminProductFormPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },
      {
        path: 'admin/products/:id/edit',
        element: (
          <AdminProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminProductFormPage />
            </Suspense>
          </AdminProtectedRoute>
        ),
      },

      // 404
      {
        path: '*',
        element: (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">404</h1>
              <p className="mt-2 text-gray-600">Page not found</p>
            </div>
          </div>
        ),
      },
    ],
  },
]);
