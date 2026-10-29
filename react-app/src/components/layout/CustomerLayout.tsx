import { useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiFileText,
  FiShoppingBag,
  FiShoppingCart,
  FiMenu,
  FiX,
  FiLogOut,
  FiHome,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../../lib/auth-context';
import logo from '../../assets/logo.png';
import { AccountMenu } from './AccountMenu';
import { AreaSwitch } from './AreaSwitch';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
}

const NAV_LINKS: NavItem[] = [
  { to: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
  { to: '/quotations', icon: <FiFileText />, label: 'Quotations' },
  { to: '/orders', icon: <FiShoppingBag />, label: 'Orders' },
];

/** One-tap mobile navigation; the sidebar stays for profile and logout. */
const MOBILE_LINKS: NavItem[] = [
  ...NAV_LINKS,
  { to: '/', icon: <FiShoppingCart />, label: 'Shop' },
];

export function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const pageTitle = location.pathname.startsWith('/quotations')
    ? 'Quotations'
    : location.pathname.startsWith('/orders')
      ? 'Orders'
      : 'Dashboard';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="aurora-stage flex min-h-screen">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-white/70 bg-white/95 backdrop-blur-xl transition-transform duration-200 ease-in-out lg:translate-x-0 lg:bg-white/85 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img
                src={logo}
                alt="CoSupply"
                className="h-8 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close sidebar"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Customer navigation">
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.to);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className={active ? 'text-primary' : 'text-gray-400'}>
                        {link.icon}
                      </span>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                <FiUser className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.phone}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <FiLogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 lg:ml-64">
        {/* Top bar: page context on the left, the way back to the shop on
            the right. Visible at every breakpoint so the area switch is
            always one tap away. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/70 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            aria-label="Open sidebar"
          >
            <FiMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 sm:text-base">
              {pageTitle}
            </p>
            <p className="truncate text-xs text-gray-500 md:hidden">{user?.name}</p>
          </div>
          <AccountMenu
            name={user?.name ?? 'Account'}
            detail={user?.phone}
            onLogout={handleLogout}
            className="hidden md:block"
          />
          <AreaSwitch
            to="/"
            label="Shop"
            icon={<FiShoppingCart />}
            description="Go to the shop"
          />
        </header>

        {/* Page content — extra bottom padding keeps the last row clear of
            the mobile quick-nav bar. */}
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile quick navigation: the three customer destinations plus a
          direct way back to the shop, always within thumb reach. */}
      <nav
        aria-label="Customer quick navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {MOBILE_LINKS.map((link) => {
            const active = link.to !== '/' && isActive(link.to);
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium motion-safe:transition-colors ${
                    active ? 'text-primary' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span aria-hidden="true" className="text-xl">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
