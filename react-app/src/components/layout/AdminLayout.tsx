import { useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  FiBox,
  FiClipboard,
  FiGrid,
  FiHome,
  FiMenu,
  FiSettings,
  FiTruck,
  FiUsers,
  FiX,
  FiLogOut,
  FiFileText,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi';
import { useAuth } from '../../lib/auth-context';
import logo from '../../assets/logo.png';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  children?: NavItem[];
}

const NAV_LINKS: NavItem[] = [
  { to: '/admin/dashboard', icon: <FiHome />, label: 'Dashboard' },
  { 
    to: '/admin/quotation-requests', 
    icon: <FiClipboard />, 
    label: 'Quotations',
    children: [
      { to: '/admin/quotation-requests', icon: <FiFileText />, label: 'All Requests' },
    ]
  },
  { to: '/admin/orders', icon: <FiTruck />, label: 'Orders' },
  { to: '/admin/products', icon: <FiBox />, label: 'Products' },
  { to: '/admin/suppliers', icon: <FiUsers />, label: 'Suppliers' },
  { to: '/admin/categories', icon: <FiGrid />, label: 'Categories' },
  { to: '/admin/settings', icon: <FiSettings />, label: 'Settings' },
];

function NavSection({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const isActive = (path: string) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const active = isActive(item.to);

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            active
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={active ? 'text-gray-900' : 'text-gray-400'}>
              {item.icon}
            </span>
            {item.label}
          </div>
          {isOpen ? (
            <FiChevronDown className="h-4 w-4" />
          ) : (
            <FiChevronRight className="h-4 w-4" />
          )}
        </button>
        {isOpen && (
          <ul className="mt-1 ml-4 space-y-1 border-l border-gray-200 pl-4">
            {item.children!.map((child) => (
              <li key={child.to}>
                <Link
                  to={child.to}
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    location.pathname === child.to
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={onClose}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-gray-100 text-gray-900'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <span className={active ? 'text-gray-900' : 'text-gray-400'}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

export function AdminLayout() {
  const { admin, adminLogout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
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
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <img
                src={logo}
                alt="CoSupply"
                className="h-8 w-auto"
              />
              <span className="text-xs font-medium text-gray-400">Admin</span>
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
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <NavSection item={link} onClose={() => setSidebarOpen(false)} />
                </li>
              ))}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                {admin?.name?.charAt(0).toUpperCase() ?? 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{admin?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{admin?.role?.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={adminLogout}
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
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Open sidebar"
          >
            <FiMenu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-gray-900">Admin</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
