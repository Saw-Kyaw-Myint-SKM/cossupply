import { healthCheck } from '../../../api/client';
import { useState, useEffect } from 'react';

/**
 * Home Page
 * 
 * Public landing page for CoSupply.
 */
export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test API health on mount
    healthCheck()
      .then((response) => {
        if (response.success && response.data) {
          setHealthStatus(response.data.status);
        } else {
          setError(response.message || 'Failed to connect to API');
        }
      })
      .catch((err: Error) => {
        setError(err.message || 'Network error');
      });
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome to CoSupply</h1>
        <p className="text-blue-100 mb-4">
          Your trusted office supplies quotation platform
        </p>
        <p className="text-sm text-blue-200">
          Browse products, request quotations, and manage orders - all in one place.
        </p>
      </div>

      {/* API Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Status</h2>
        {healthStatus && (
          <div className="flex items-center gap-2 text-green-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">API is {healthStatus}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}
        {!healthStatus && !error && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
            <span>Checking API connection...</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Browse Products</h3>
          <p className="text-gray-600 text-sm mb-4">
            Explore our catalog of office supplies from various suppliers.
          </p>
          <a href="/products" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
            View Products &rarr;
          </a>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Quotation</h3>
          <p className="text-gray-600 text-sm mb-4">
            Add items to cart and submit a quotation request.
          </p>
          <a href="/cart" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
            View Cart &rarr;
          </a>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Track Orders</h3>
          <p className="text-gray-600 text-sm mb-4">
            Monitor your quotation and order status.
          </p>
          <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
            Login to Dashboard &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
