import { Link } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';

/**
 * Customer Dashboard Page
 */
export default function CustomerDashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome, {user?.name}!
        </h1>
        <p className="text-gray-600 mb-4">
          This is your customer dashboard. From here you can manage your quotations and orders.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quotations</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-500 mt-1">Active quotations</p>
          <Link to="/quotations" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
            View all &rarr;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Orders</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
          <p className="text-sm text-gray-500 mt-1">Total orders</p>
          <Link to="/orders" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
            View all &rarr;
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">New Quotation</h3>
          <p className="text-gray-600 text-sm mb-4">
            Add products to cart and request a quotation.
          </p>
          <Link to="/cart" className="text-sm text-blue-600 hover:text-blue-800">
            View Cart &rarr;
          </Link>
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.email || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Company</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.company_name || 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Account Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{user?.customer_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {user?.status}
              </span>
            </dd>
          </div>
        </dl>
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
