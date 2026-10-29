import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  FiBox,
  FiClipboard,
  FiGrid,
  FiHome,
  FiMenu,
  FiShoppingCart,
  FiUser,
  FiX,
} from 'react-icons/fi';
import logo from '../../assets/logo.png';
import flagMM from '../../assets/flag-myanmar.png';
import flagEN from '../../assets/flag-english.png';
import { AccountMenu } from './AccountMenu';
import { AreaSwitch } from './AreaSwitch';
import { useAuth } from '../../lib/auth-context';
import { useCart } from '../../lib/cart-context';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';

/** The order-list badge: the one accent-inked spot, rolling on every unit. */
function OrderListCount({ count, tone = 'solid' }: { count: number; tone?: 'solid' | 'soft' }) {
  return (
    <span
      key={count}
      aria-label={`${count} items in your order list`}
      className={`animate-badge-pop motion-reduce:animate-none inline-flex min-w-5 items-center justify-center overflow-hidden rounded-full px-1.5 py-0.5 align-baseline text-[11px] font-bold ${
        tone === 'solid' ? 'bg-red-500 text-white shadow-lg shadow-amber-500/30' : 'bg-amber-100 text-amber-700'
      }`}
    >
      <span className="motion-safe:animate-count-roll">{count}</span>
    </span>
  );
}

const MENU_LINKS: Array<{ to: string; icon: ReactNode; label: string }> = [
  { to: '/', icon: <FiHome />, label: 'Home' },
  { to: '/products', icon: <FiBox />, label: 'Products' },
  { to: '/categories', icon: <FiGrid />, label: 'Categories' },
];

export function AppLayout() {
  const location = useLocation();
  const { user, admin, isAuthenticated, userType, logout, adminLogout } = useAuth();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'my'>('en');

  useEffect(() => {
    // Any navigation closes the drawer; keeping state across routes would
    // leave the sheet open over a changed page.
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    // Freeze the page behind the overlay so only the menu panel scrolls.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const handleLogout = () => {
    if (userType === 'admin') {
      adminLogout();
    } else {
      logout();
    }
  };

  const accountName = userType === 'customer' ? user?.name : admin?.name;
  const accountDetail = userType === 'customer' ? user?.phone : admin?.email;
  const dashboardHref = userType === 'admin' ? '/admin/dashboard' : '/dashboard';

  return (
    <div className="aurora-stage flex min-h-screen flex-col text-ink">
      {/* Solid on mobile so scrolling content never shows through the header;
          the frosted glass treatment is kept from `lg` up. */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:border-white/60 lg:bg-white/70 lg:backdrop-blur-xl">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="flex h-[68px] items-center justify-between gap-4 lg:gap-8">
            {/* Left: Menu + Logo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 active:scale-95 motion-safe:transition-all lg:hidden"
              >
                {menuOpen ? (
                  <FiX aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <FiMenu aria-hidden="true" className="h-5 w-5" />
                )}
              </button>

              <Link
                to="/"
                className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
                aria-label="CoSupply home"
              >
                <img
                  src={logo}
                  alt="CoSupply"
                  className="h-10 w-auto sm:h-11"
                />
              </Link>
            </div>

            {/* Center: Desktop nav links */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
              {MENU_LINKS.map((item) => {
                const active =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-600 hover:bg-white/60 hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* The other half of the app: signed-in customers jump straight
                  into their dashboard, admins into the admin dashboard. */}
              {isAuthenticated ? (
                <AreaSwitch
                  to={dashboardHref}
                  label="Dashboard"
                  icon={<FiGrid />}
                  description="Go to your dashboard"
                />
              ) : null}
              {/* Order list - the hero accent moment */}
              <Link
                to="/cart"
                aria-label={`Order list${count > 0 ? `, ${count} items` : ''}`}
                className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-amber-50 hover:text-amber-700 active:scale-95 motion-safe:transition-all lg:w-auto lg:gap-2.5 lg:px-4 lg:pr-5"
              >
                <FiShoppingCart aria-hidden="true" className="h-5 w-5" />
                <span className="hidden lg:inline text-sm font-medium">Order list</span>
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 motion-safe:transition-transform"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </Link>

              {/* Language toggle — desktop only; mobile keeps the header
                  clear for the signed-in customer's name. */}
              <button
                type="button"
                onClick={() => setLang((l) => (l === 'en' ? 'my' : 'en'))}
                className="relative hidden h-6 w-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow active:scale-95 motion-safe:transition-all sm:block lg:ml-1"
                aria-label={`Switch to ${lang === 'en' ? 'Myanmar' : 'English'} language`}
              >
                <img
                  src={lang === 'en' ? flagEN : flagMM}
                  alt={lang === 'en' ? 'English flag' : 'Myanmar flag'}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>

              {/* Account: on desktop the customer's name opens a small
                  account popover with log-out; phones keep the compact avatar
                  and log out from the drawer. */}
              {isAuthenticated ? (
                <>
                  <NotificationBell />
                  <AccountMenu
                    name={accountName ?? 'Account'}
                    detail={accountDetail}
                    onLogout={handleLogout}
                    className="hidden md:block"
                  />
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-xs font-semibold text-white shadow-sm md:hidden"
                  >
                    {accountName?.charAt(0).toUpperCase() ?? (
                      <FiUser className="h-[18px] w-[18px]" />
                    )}
                  </span>
                </>
              ) : (
                <Link
                  to="/login"
                  className="hidden items-center gap-2 rounded-lg bg-primary px-2 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] motion-safe:transition-all md:inline-flex"
                >
                  <FiUser aria-hidden="true" className="h-[18px] w-[18px]" />
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay: floats above the page content instead of
          pushing it down, with a dimmed backdrop that closes on tap. */}
      {menuOpen ? (
        <div className="fixed inset-x-0 top-[68px] bottom-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-menu"
            className="relative max-h-full overflow-y-auto rounded-b-2xl border-b border-gray-200 bg-white shadow-xl motion-safe:animate-drawer-in"
          >
            <nav aria-label="Primary mobile" className="flex flex-col gap-1 px-4 py-4">
              {MENU_LINKS.map((item) => {
                const active =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span aria-hidden="true" className={active ? 'text-primary' : 'text-gray-400'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/cart"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700"
              >
                <span aria-hidden="true" className="text-gray-400">
                  <FiClipboard />
                </span>
                Order list
                {count > 0 ? <OrderListCount count={count} tone="soft" /> : null}
              </Link>

              <div className="mt-3 border-t border-gray-100 pt-4">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Log out ({accountName})
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-2 rounded-xl bg-primary px-2 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <span aria-hidden="true" className="text-blue-200">
                      <FiUser />
                    </span>
                    Sign in
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <main className="w-full flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
