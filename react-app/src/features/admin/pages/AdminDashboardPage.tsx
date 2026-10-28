import { Link } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';

/**
 * Admin Dashboard Page
 */
export default function AdminDashboardPage() {
  const { admin, adminLogout } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 mb-2">
          Welcome, {admin?.name}!
        </p>
        <p className="text-sm text-gray-500">
          Role: <span className="capitalize">{admin?.role}</span>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quotation Requests</h3>
          <p className="text-3xl font-bold text-ink">0</p>
          <p className="text-sm text-gray-500 mt-1">Pending requests</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Orders</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
          <p className="text-sm text-gray-500 mt-1">Total orders</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Products</h3>
          <p className="text-3xl font-bold text-purple-600">0</p>
          <p className="text-sm text-gray-500 mt-1">Published products</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Suppliers</h3>
          <p className="text-3xl font-bold text-orange-600">0</p>
          <p className="text-sm text-gray-500 mt-1">Active suppliers</p>
        </div>
      </div>

      {/* Management Links */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Management</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/admin/suppliers"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Suppliers</span>
            <span className="text-sm text-gray-500">Manage suppliers</span>
          </Link>
          <Link
            to="/admin/categories"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Categories</span>
            <span className="text-sm text-gray-500">Manage categories</span>
          </Link>
          <Link
            to="/admin/products"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Products</span>
            <span className="text-sm text-gray-500">Manage products</span>
          </Link>
          <Link
            to="/admin/quotations"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Quotations</span>
            <span className="text-sm text-gray-500">Manage quotations</span>
          </Link>
          <Link
            to="/admin/orders"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Orders</span>
            <span className="text-sm text-gray-500">Confirm suppliers</span>
          </Link>
          <Link
            to="/admin/settings"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Master Settings</span>
            <span className="text-sm text-gray-500">Manage settings</span>
          </Link>
          <Link
            to="/admin/email-logs"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Email log</span>
            <span className="text-sm text-gray-500">Delivery errors &amp; resend</span>
          </Link>
          <Link
            to="/notifications"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-center"
          >
            <span className="block font-medium text-gray-900">Notifications</span>
            <span className="text-sm text-gray-500">Your notification center</span>
          </Link>
        </div>
      </div>

      {/* Admin Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{admin?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{admin?.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{admin?.role}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Login</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {admin?.last_login_at ? new Date(admin.last_login_at).toLocaleString() : 'First login'}
            </dd>
          </div>
        </dl>
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={adminLogout}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
