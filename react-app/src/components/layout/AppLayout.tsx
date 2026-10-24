import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  FiBox,
  FiClipboard,
  FiGrid,
  FiHome,
  FiMenu,
  FiMessageCircle,
  FiShoppingCart,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { listCategories, type PublicCategory } from '../../api/catalog';
import { useAuth } from '../../lib/auth-context';
import { useCart } from '../../lib/cart-context';

/** The order-list badge: the one accent-inked spot, rolling on every unit. */
function OrderListCount({ count, tone = 'solid' }: { count: number; tone?: 'solid' | 'soft' }) {
  return (
    <span
      key={count}
      aria-label={`${count} items in your order list`}
      className={`animate-badge-pop motion-reduce:animate-none inline-flex min-w-5 items-center justify-center overflow-hidden rounded-lg px-1.5 py-0.5 align-baseline text-[11px] font-medium ${
        tone === 'solid' ? 'bg-primary text-white' : 'bg-accent-soft text-primary'
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
  const [categories, setCategories] = useState<PublicCategory[]>([]);

  useEffect(() => {
    // Any navigation closes the drawer; keeping state across routes would
    // leave the sheet open over a changed page.
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;

    let cancelled = false;
    listCategories({ per_page: 12 })
      .then((response) => {
        if (!cancelled && response.success && response.data) {
          setCategories(response.data.categories);
        }
      })
      .catch(() => {
        // The rail is navigation sugar; the catalog pages still work without it.
      });

    return () => {
      cancelled = true;
    };
    // Load once per session; the category tree changes rarely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const accountName = userType === 'customer' ? user?.name : admin?.name;
  const dashboardHref = userType === 'admin' ? '/admin/dashboard' : '/dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/60 bg-plate/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
          <div className="flex h-16 items-center gap-3 lg:gap-8">
            <div className="flex flex-none items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-accent-soft active:scale-[.97] motion-safe:transition-colors lg:hidden"
              >
                {menuOpen ? (
                  <FiX aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <FiMenu aria-hidden="true" className="h-5 w-5" />
                )}
              </button>

              <Link
                to="/"
                className="text-[22px] font-bold tracking-tight text-primary sm:text-[24px]"
              >
                CoSupply
              </Link>
            </div>

            {/* Desktop nav links fill the space the search bar used to hold. */}
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
                    className={`rounded-lg px-3 py-2 text-sm font-medium motion-safe:transition-colors ${
                      active
                        ? 'bg-accent-soft text-primary'
                        : 'text-muted hover:bg-accent-soft hover:text-primary'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
                            <Link
                to="/cart"
                aria-label={`Order list${count > 0 ? `, ${count} items` : ''}`}
                className="relative inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-ink hover:bg-accent-soft hover:text-primary active:scale-[.98] motion-safe:transition-colors"
              >
                <FiShoppingCart aria-hidden="true" className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Order list</span>
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold text-white"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </Link>
              <div className="hidden items-center gap-3 md:flex">
                {isAuthenticated ? (
                  <>
                    <Link
                      to={dashboardHref}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-primary motion-safe:transition-colors"
                    >
                      <FiUser aria-hidden="true" className="h-[18px] w-[18px]" />
                      <span className="max-w-[120px] truncate">{accountName}</span>
                    </Link>
                    <span aria-hidden="true" className="h-5 w-px bg-rule" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-sm text-muted hover:text-primary motion-safe:transition-colors"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-primary motion-safe:transition-colors"
                  >
                    <FiUser aria-hidden="true" className="h-[18px] w-[18px]" />
                    Sign in
                  </Link>
                )}
                <span aria-hidden="true" className="h-5 w-px bg-rule" />
              </div>
            </div>
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
                className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-ink active:bg-paper"
              >
                <span aria-hidden="true" className="text-muted">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
            <Link
              to="/cart"
              className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-ink active:bg-paper"
            >
              <span aria-hidden="true" className="text-muted">
                <FiClipboard />
              </span>
              Order list
              {count > 0 ? <OrderListCount count={count} tone="soft" /> : null}
            </Link>

            <div className="mt-2 border-t border-rule pt-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-red-700"
                >
                  Log out ({accountName})
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2 rounded-md px-2 py-2.5 text-sm text-ink"
                >
                  <span aria-hidden="true" className="text-muted">
                    <FiUser />
                  </span>
                  Sign up / Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : null}

      {/* Main content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-6 lg:px-6">
        <Outlet />
      </main>

      {/* Footer: business invitation on the tint, then the dark link floor. */}
      <footer className="bg-night text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-2 lg:grid-cols-[290px_195px_195px_1fr] lg:justify-between lg:px-6">
          <div className="space-y-[22px]">
            <p className="text-[32px] font-bold leading-none">CoSupply</p>
            <p className="max-w-[290px] text-[13px] leading-relaxed text-white/80">
              Your everyday partner for a better workplace. Office supplies for every desk in
              Myanmar, sold on a quotation basis.
            </p>
            <p className="text-base font-medium">Contact us</p>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <FiMessageCircle aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="text-[13px] leading-snug">
                <p className="text-white/70">Quotation support</p>
                <p className="font-semibold">Viber with your representative</p>
              </div>
            </div>
            <p>
              <Link to="/admin/login" className="text-sm text-white/70 hover:text-white">
                Supplier / admin login
              </Link>
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:w-[195px]">
            <p className="text-[17px] font-semibold">Popular categories</p>
            <span aria-hidden="true" className="h-0.5 w-20 rounded-full bg-primary" />
            {categories.length > 0 ? (
              categories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/products?category_id=${category.id}`}
                  className="text-[13px] text-white/80 hover:text-white"
                >
                  {category.name_en}
                </Link>
              ))
            ) : (
              <>
                <Link to="/products" className="text-[13px] text-white/80 hover:text-white">
                  Full catalog
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:w-[195px]">
            <p className="text-[17px] font-semibold">Customer service</p>
            <span aria-hidden="true" className="h-0.5 w-20 rounded-full bg-primary" />
            <Link to="/" className="text-[13px] text-white/80 hover:text-white">
              Home
            </Link>
            <Link to="/products" className="text-[13px] text-white/80 hover:text-white">
              Browse products
            </Link>
            <Link to="/categories" className="text-[13px] text-white/80 hover:text-white">
              Shop categories
            </Link>
            <Link to="/cart" className="text-[13px] text-white/80 hover:text-white">
              Order list
            </Link>
            <Link to="/dashboard" className="text-[13px] text-white/80 hover:text-white">
              Your dashboard
            </Link>
            <Link to="/login" className="text-[13px] text-white/80 hover:text-white">
              Sign in
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[17px] font-semibold">How buying works</p>
            <span aria-hidden="true" className="h-0.5 w-20 rounded-full bg-primary" />
            <p className="text-[13px] leading-relaxed text-white/80">
              Prices here are display prices. Your supplier confirms the final price and stock
              before the quotation is issued.
            </p>
            <ol className="space-y-2 text-[13px] text-white/80">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
                  1
                </span>
                Browse and build your order list
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
                  2
                </span>
                Request a quotation from your list
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
                  3
                </span>
                Supplier confirms, then delivers — cash on delivery
              </li>
            </ol>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <p>&copy; {new Date().getFullYear()} CoSupply</p>
            <p>Display prices — final pricing is confirmed in your quotation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
