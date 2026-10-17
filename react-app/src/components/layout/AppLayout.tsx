import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { useCart } from '../../lib/cart-context';

/**
 * Main Application Layout
 * 
 * Wraps all pages with common layout structure.
 */
export function AppLayout() {
  const location = useLocation();
  const { user, admin, isAuthenticated, userType, logout, adminLogout } = useAuth();
  const { count } = useCart();

  const handleLogout = () => {
    if (userType === 'admin') {
      adminLogout();
    } else {
      logout();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-semibold text-gray-900">
              CoSupply
            </Link>
            
            <nav className="flex items-center gap-6">
              <Link 
                to="/" 
                className={`text-sm ${location.pathname === '/' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Home
              </Link>
              <Link 
                to="/products" 
                className={`text-sm ${location.pathname.startsWith('/products') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Products
              </Link>
              <Link 
                to="/categories" 
                className={`text-sm ${location.pathname.startsWith('/categories') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Categories
              </Link>
              <Link 
                to="/cart" 
                className={`text-sm ${location.pathname === '/cart' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Cart
                {count > 0 ? (
                  <span
                    className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white"
                    aria-label={`${count} items in cart`}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
              
              {isAuthenticated ? (
                <>
                  {userType === 'customer' && user && (
                    <Link 
                      to="/dashboard" 
                      className={`text-sm ${location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/quotations') || location.pathname.startsWith('/orders') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Dashboard
                    </Link>
                  )}
                  {userType === 'admin' && admin && (
                    <Link 
                      to="/admin/dashboard" 
                      className={`text-sm ${location.pathname.startsWith('/admin') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Admin Panel
                    </Link>
                  )}
                  <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
                    <span className="text-sm text-gray-600">
                      {userType === 'customer' ? user?.name : admin?.name}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800">
                    Customer Login
                  </Link>
                  <Link to="/admin/login" className="text-sm text-gray-600 hover:text-gray-900">
                    Admin Login
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} CoSupply. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
