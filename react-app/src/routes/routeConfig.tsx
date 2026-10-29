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
const NotificationsPage = lazy(() => import('../features/notifications/pages/NotificationsPage'));
const QuotationRequestFormPage = lazy(() => import('../features/quotations/pages/QuotationRequestFormPage'));
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
const QuotationRequestListPage = lazy(
  () => import('../features/admin/pages/QuotationRequestListPage'),
);
const QuotationRequestDetailPage = lazy(
  () => import('../features/admin/pages/QuotationRequestDetailPage'),
);
const QuotationVersionFormPage = lazy(
  () => import('../features/admin/pages/QuotationVersionFormPage'),
);
const AdminOrderListPage = lazy(() => import('../features/admin/pages/OrderListPage'));
const AdminOrderDetailPage = lazy(() => import('../features/admin/pages/OrderDetailPage'));
const AdminEmailLogsPage = lazy(() => import('../features/admin/pages/EmailLogsPage'));
const AdminAuditLogsPage = lazy(() => import('../features/admin/pages/AuditLogsPage'));
const AdminCustomersPage = lazy(() => import('../features/admin/pages/CustomersPage'));

// Layout
import { AppLayout } from '../components/layout/AppLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { CustomerLayout } from '../components/layout/CustomerLayout';

// Route guards
import {
  AdminProtectedRoute,
  AuthenticatedRoute,
  CustomerProtectedRoute,
  GuestRoute,
} from './guards';

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
  </div>
);

export const router = createBrowserRouter([
  // Admin routes with AdminLayout
  {
    path: '/admin',
    element: (
      <AdminProtectedRoute>
        <AdminLayout />
      </AdminProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminDashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminSettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'categories',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminCategoryListPage />
          </Suspense>
        ),
      },
      {
        path: 'categories/new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CategoryFormPage />
          </Suspense>
        ),
      },
      {
        path: 'categories/:id/edit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CategoryFormPage />
          </Suspense>
        ),
      },
      {
        path: 'suppliers',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SupplierListPage />
          </Suspense>
        ),
      },
      {
        path: 'suppliers/new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SupplierFormPage />
          </Suspense>
        ),
      },
      {
        path: 'suppliers/:id/edit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SupplierFormPage />
          </Suspense>
        ),
      },
      {
        path: 'products',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminProductListPage />
          </Suspense>
        ),
      },
      {
        path: 'products/new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminProductFormPage />
          </Suspense>
        ),
      },
      {
        path: 'products/:id/edit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminProductFormPage />
          </Suspense>
        ),
      },
      {
        path: 'quotations',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationRequestListPage />
          </Suspense>
        ),
      },
      {
        path: 'quotation-requests',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationRequestListPage />
          </Suspense>
        ),
      },
      {
        path: 'quotation-requests/:requestId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationRequestDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'quotation-requests/:requestId/versions/new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationVersionFormPage />
          </Suspense>
        ),
      },
      {
        path: 'quotations/:quotationId/edit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationVersionFormPage />
          </Suspense>
        ),
      },
      {
        path: 'orders',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminOrderListPage />
          </Suspense>
        ),
      },
      {
        path: 'orders/:orderId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminOrderDetailPage />
          </Suspense>
        ),
      },
      {
        path: 'email-logs',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminEmailLogsPage />
          </Suspense>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminAuditLogsPage />
          </Suspense>
        ),
      },
      {
        path: 'customers',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AdminCustomersPage />
          </Suspense>
        ),
      },
    ],
  },

  // Customer and public routes with AppLayout
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
      {
        path: 'notifications',
        element: (
          <AuthenticatedRoute>
            <Suspense fallback={<PageLoader />}>
              <NotificationsPage />
            </Suspense>
          </AuthenticatedRoute>
        ),
      },

      // Admin Auth Route (outside admin layout)
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

  // Customer routes own their layout: the storefront header, mobile drawer,
  // and page padding must never wrap the dashboard.
  {
    path: '/dashboard',
    element: (
      <CustomerProtectedRoute>
        <CustomerLayout />
      </CustomerProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <CustomerDashboardPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/quotations',
    element: (
      <CustomerProtectedRoute>
        <CustomerLayout />
      </CustomerProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationListPage />
          </Suspense>
        ),
      },
      {
        path: 'new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationRequestFormPage />
          </Suspense>
        ),
      },
      {
        path: ':id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <QuotationDetailPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/orders',
    element: (
      <CustomerProtectedRoute>
        <CustomerLayout />
      </CustomerProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <OrderListPage />
          </Suspense>
        ),
      },
      {
        path: ':id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <OrderDetailPage />
          </Suspense>
        ),
      },
    ],
  },
]);
