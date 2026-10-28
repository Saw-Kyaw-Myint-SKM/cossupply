import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiBox, FiChevronRight, FiClipboard, FiGrid, FiHome, FiMenu, FiMessageCircle, FiSearch, FiTruck, FiX } from 'react-icons/fi';
import { useAuth } from '../../lib/auth-context';
import { useCart } from '../../lib/cart-context';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';

/** Active state = ink + amber underline; the accent is spent here on purpose. */
const NAV_ITEM_CLASS =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm motion-safe:transition-colors hover:text-ink';

function navHref(item: string, pathname: string): boolean {
  return item === '/' ? pathname === '/' : pathname.startsWith(item);
}

function NavLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  const location = useLocation();
  const active = navHref(to, location.pathname);

  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`${NAV_ITEM_CLASS} ${
        active ? 'text-ink shadow-[inset_0_-2px_0_0_var(--color-accent)]' : 'text-gray-600'
      }`}
    >
      <span aria-hidden="true" className="text-current">
        {icon}
      </span>
      {children}
    </Link>
  );
}

/** The order-list badge: the one accent-inked spot, rolling on every unit. */
function OrderListCount({ count }: { count: number }) {
  return (
    <span
      key={count}
      aria-label={`${count} items in your order list`}
      className="animate-badge-pop motion-reduce:animate-none inline-flex min-w-5 items-center justify-center overflow-hidden rounded-full bg-accent px-1.5 py-0.5 align-baseline text-xs font-medium text-white"
    >
      <span className="motion-safe:animate-count-roll">{count}</span>
    </span>
  );
}

/** Global catalog search — submits to the product list with the term in the URL. */
function HeaderSearch({ onMobile, className = '' }: { onMobile?: boolean; className?: string }) {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : '/products');
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`${className} flex w-full items-stretch overflow-hidden rounded-md border border-gray-300 bg-plate focus-within:border-accent focus-within:ring-2 focus-within:ring-accent motion-safe:transition-colors`}
    >
      <label htmlFor={`header-search-${onMobile ? 'm' : 'd'}`} className="sr-only">
        Search the catalog
      </label>
      <input
        id={`header-search-${onMobile ? 'm' : 'd'}`}
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search products, SKU, brand…"
        maxLength={100}
        className="w-full bg-transparent px-3 py-2 text-sm text-ink outline-none min-w-0"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex flex-none items-center justify-center bg-primary px-3 text-white hover:bg-primary-hover active:scale-[.99] motion-safe:transition-colors"
      >
        <FiSearch aria-hidden="true" className="h-4 w-4" />
      </button>
    </form>
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

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  const handleLogout = () => {
    if (userType === 'admin') {
      adminLogout();
    } else {
      logout();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-gray-800">
      {/* Header: ink on paper, sticky, hairline rule. */}
      <header className="sticky top-0 z-40 border-b border-rule bg-plate/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="relative flex items-center gap-3 py-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-gray-300 bg-plate text-ink active:scale-[.99] lg:hidden"
            >
              {menuOpen ? <FiX aria-hidden="true" className="h-5 w-5" /> : <FiMenu aria-hidden="true" className="h-5 w-5" />}
            </button>

            <Link to="/" className="flex-none text-xl font-semibold tracking-tight text-ink">
              Co<span className="text-accent">Supply</span>
            </Link>

            {/* Centered on wide screens: the search sits exactly between
                the wordmark and the nav, never hugging either side. */}
            <HeaderSearch className="absolute left-1/2 hidden w-full max-w-md -translate-x-1/2 -translate-y-1/2 top-1/2 lg:flex" />

            <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:flex">
              {MENU_LINKS.map((item) => (
                <NavLink key={item.to} to={item.to} icon={item.icon}>
                  {item.label}
                </NavLink>
              ))}
              <NavLink to="/cart" icon={<FiClipboard />}>
                Order list
              </NavLink>
            </nav>

            <div className="ml-auto flex items-center gap-1 lg:hidden">
              {isAuthenticated ? <NotificationBell /> : null}
              <Link
                to="/cart"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-ink active:scale-[.99] sm:ml-2"
                aria-label={`Order list${count > 0 ? `, ${count} items` : ''}`}
              >
                <FiClipboard aria-hidden="true" className="h-5 w-5" />
                {/* Mobile badge shares the pill; count stays aria-hidden here. */}
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </Link>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              {isAuthenticated ? (
                <>
                  <NotificationBell />
                  <NavLink
                    to={userType === 'admin' ? '/admin/dashboard' : '/dashboard'}
                    icon={<FiGrid />}
                  >
                    {userType === 'admin' ? 'Admin panel' : 'Dashboard'}
                  </NavLink>
                  <span className="border-l border-rule pl-3 text-sm text-gray-600">
                    {userType === 'customer' ? user?.name : admin?.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-sm font-medium text-ink hover:text-accent"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link to="/login" className={`${NAV_ITEM_CLASS} text-ink`}>
                  Customer login
                </Link>
              )}
            </div>
          </div>

          {/* Tablet/mobile search row: search is never more than one glance away. */}
          <div className="pb-3 lg:hidden">
            <HeaderSearch onMobile />
          </div>
        </div>
      </header>

      {/* Mobile drawer: opening answers a press; Esc closes. */}
      {menuOpen ? (
        <div
          id="mobile-menu"
          className="motion-safe:animate-drawer-in border-b border-rule bg-plate lg:hidden"
        >
          <nav aria-label="Primary mobile" className="flex flex-col gap-1 px-4 py-3">
            {MENU_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-ink active:bg-gray-50"
              >
                <span aria-hidden="true" className="text-gray-500">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
            <Link
              to="/cart"
              className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-ink active:bg-gray-50"
            >
              <span aria-hidden="true" className="text-gray-500">
                <FiClipboard />
              </span>
              Order list
              {count > 0 ? <OrderListCount count={count} /> : null}
            </Link>

            <div className="mt-2 border-t border-rule pt-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-red-700"
                >
                  Log out ({userType === 'customer' ? user?.name : admin?.name})
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-ink"
                >
                  <span aria-hidden="true" className="text-gray-500">
                    <FiClipboard />
                  </span>
                  Customer login
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : null}

      {/* Main content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-6 pt-6 sm:px-4 lg:px-6">
        <Outlet />
      </main>

      {/* Footer: contact + the honest path how buying works. */}
      <footer className="border-t border-rule bg-plate">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-3 py-5 sm:grid-cols-3 sm:px-4 lg:px-6">
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">
              Co<span className="text-accent">Supply</span>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Office supplies for Myanmar, sold on a quotation basis. Display prices here;
              final pricing is confirmed by your supplier.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">How buying works</h2>
            <ol className="mt-2 space-y-1.5 text-sm text-gray-600">
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-gray-400">
                  <FiChevronRight className="mt-0.5 h-3.5 w-3.5" />
                </span>
                Browse and build your order list
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-gray-400">
                  <FiChevronRight className="mt-0.5 h-3.5 w-3.5" />
                </span>
                Request a quotation from your list
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-gray-400">
                  <FiChevronRight className="mt-0.5 h-3.5 w-3.5" />
                </span>
                Supplier confirms price and stock, then delivers
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-gray-400">
                  <FiTruck className="mt-0.5 h-3.5 w-3.5" />
                </span>
                Cash on delivery, full payment
              </li>
            </ol>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Customer service</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <span aria-hidden="true" className="text-gray-500">
                <FiMessageCircle className="h-4 w-4" />
              </span>
              Quotation support runs over Viber with your representative.
            </p>
            <p className="mt-3 text-sm">
              <Link to="/admin/login" className="text-gray-500 hover:text-ink">
                Supplier / admin login
              </Link>
            </p>
          </div>
        </div>
        <div className="border-t border-rule py-3 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} CoSupply
        </div>
      </footer>
    </div>
  );
}
