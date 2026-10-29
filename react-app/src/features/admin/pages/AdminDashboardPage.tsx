import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertCircle,
  FiBox,
  FiClipboard,
  FiTruck,
  FiTrendingUp,
  FiUsers,
  FiSettings,
  FiGrid,
  FiMail,
  FiActivity,
  FiBell,
  FiRefreshCw,
} from 'react-icons/fi';
import { listAdminOrders } from '../api/orderAdminApi';
import { listAdminQuotationRequests, type QuotationRequestStatus } from '../api/quotationAdminApi';
import { listProducts, type ProductStatus } from '../api/productsApi';
import { listSuppliers, type SupplierStatus } from '../api/suppliersApi';
import { useAuth } from '../../../lib/auth-context';

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  total: number | null;
  totalLabel: string;
  actionableCount: number | null;
  actionableLabel: string;
  actionableHref?: string;
  error?: boolean;
  onRetry?: () => void;
}

function StatCard({
  title,
  icon,
  iconBg,
  total,
  totalLabel: _totalLabel,
  actionableCount,
  actionableLabel,
  actionableHref,
  error,
  onRetry,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Main row: Icon | Title | Count */}
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl shadow-lg ${iconBg}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-600 flex-1">{title}</span>
        <span className="text-xl font-bold text-slate-800">
          {total === null ? (error ? '—' : '…') : total.toLocaleString('en-US')}
        </span>
      </div>

      {/* Actionable subset */}
      {actionableCount !== null && actionableCount > 0 && actionableHref ? (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <Link
            to={actionableHref}
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <FiAlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {actionableCount.toLocaleString('en-US')} {actionableLabel}
            </span>
            <span aria-hidden="true" className="group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </Link>
        </div>
      ) : actionableCount !== null && actionableCount === 0 ? (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <FiTrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            All caught up
          </span>
        </div>
      ) : null}

      {/* Error retry */}
      {error && onRetry ? (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface QuickLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function QuickLink({ to, icon, label, description }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-200/50 bg-white/80 backdrop-blur-sm p-3 hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-500 group-hover:from-indigo-500 group-hover:to-purple-500 group-hover:text-white transition-all">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

/**
 * Admin Dashboard Page
 */
export default function AdminDashboardPage() {
  const { admin } = useAuth();

  // Order stats
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [orderActionable, setOrderActionable] = useState<number | null>(null);
  const [orderError, setOrderError] = useState(false);
  const [orderReload, setOrderReload] = useState(0);

  // Quotation stats
  const [quotationTotal, setQuotationTotal] = useState<number | null>(null);
  const [quotationActionable, setQuotationActionable] = useState<number | null>(null);
  const [quotationError, setQuotationError] = useState(false);
  const [quotationReload, setQuotationReload] = useState(0);

  // Product stats
  const [productTotal, setProductTotal] = useState<number | null>(null);
  const [productOutOfStock, setProductOutOfStock] = useState<number | null>(null);
  const [productError, setProductError] = useState(false);
  const [productReload, setProductReload] = useState(0);

  // Supplier stats
  const [supplierTotal, setSupplierTotal] = useState<number | null>(null);
  const [supplierActive, setSupplierActive] = useState<number | null>(null);
  const [supplierError, setSupplierError] = useState(false);
  const [supplierReload, setSupplierReload] = useState(0);

  // Load orders
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setOrderError(false);

      // Load total count
      const totalRes = await listAdminOrders({ page: 1, per_page: 1 });
      if (cancelled) return;

      if (totalRes.success && totalRes.data) {
        setOrderTotal(totalRes.data.meta.total);
      } else {
        setOrderError(true);
        return;
      }

      // Load actionable count (SUPPLIER_CONFIRMATION_REQUIRED)
      const actionableRes = await listAdminOrders({
        page: 1,
        per_page: 1,
        status: 'SUPPLIER_CONFIRMATION_REQUIRED',
      });
      if (cancelled) return;

      if (actionableRes.success && actionableRes.data) {
        setOrderActionable(actionableRes.data.meta.total);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderReload]);

  // Load quotations
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setQuotationError(false);

      // Load total count
      const totalRes = await listAdminQuotationRequests({ page: 1, per_page: 1 });
      if (cancelled) return;

      if (totalRes.success && totalRes.data) {
        setQuotationTotal(totalRes.data.meta.total);
      } else {
        setQuotationError(true);
        return;
      }

      // Load actionable counts (NEW + CONTACTING_SUPPLIER + SUPPLIER_RESPONSE_PENDING)
      const statuses: QuotationRequestStatus[] = [
        'NEW',
        'CONTACTING_SUPPLIER',
        'SUPPLIER_RESPONSE_PENDING',
        'PREPARING_QUOTATION',
      ];
      let actionableSum = 0;

      for (const status of statuses) {
        const res = await listAdminQuotationRequests({ page: 1, per_page: 1, status });
        if (cancelled) return;
        if (res.success && res.data) {
          actionableSum += res.data.meta.total;
        }
      }

      if (!cancelled) {
        setQuotationActionable(actionableSum);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [quotationReload]);

  // Load products
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setProductError(false);

      // Load total count
      const totalRes = await listProducts({ page: 1, per_page: 1 });
      if (cancelled) return;

      if (totalRes.success && totalRes.data) {
        setProductTotal(totalRes.data.meta.total);
      } else {
        setProductError(true);
        return;
      }

      // Load out of stock count
      const oosRes = await listProducts({
        page: 1,
        per_page: 1,
        status: 'OUT_OF_STOCK' as ProductStatus,
      });
      if (cancelled) return;

      if (oosRes.success && oosRes.data) {
        setProductOutOfStock(oosRes.data.meta.total);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [productReload]);

  // Load suppliers
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setSupplierError(false);

      // Load total count
      const totalRes = await listSuppliers({ page: 1, per_page: 1 });
      if (cancelled) return;

      if (totalRes.success && totalRes.data) {
        setSupplierTotal(totalRes.data.meta.total);
      } else {
        setSupplierError(true);
        return;
      }

      // Load active count
      const activeRes = await listSuppliers({
        page: 1,
        per_page: 1,
        status: 'ACTIVE' as SupplierStatus,
      });
      if (cancelled) return;

      if (activeRes.success && activeRes.data) {
        setSupplierActive(activeRes.data.meta.total);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [supplierReload]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Context bar */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {admin?.name?.split(' ')[0] ?? 'Admin'}
        </h1>
        <p className="text-sm text-slate-500">{today}</p>
      </div>

      {/* Statistics Cards - 4 in one row */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">Overview</h2>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Orders"
            icon={<FiTruck className="h-5 w-5 text-white" aria-hidden="true" />}
            iconBg="bg-gradient-to-br from-emerald-400 to-teal-500"
            total={orderTotal}
            totalLabel="total"
            actionableCount={orderActionable}
            actionableLabel="need confirmation"
            actionableHref="/admin/orders?status=SUPPLIER_CONFIRMATION_REQUIRED"
            error={orderError}
            onRetry={() => setOrderReload((n) => n + 1)}
          />
          <StatCard
            title="Quotations"
            icon={<FiClipboard className="h-5 w-5 text-white" aria-hidden="true" />}
            iconBg="bg-gradient-to-br from-indigo-400 to-purple-500"
            total={quotationTotal}
            totalLabel="total"
            actionableCount={quotationActionable}
            actionableLabel="in progress"
            actionableHref="/admin/quotation-requests"
            error={quotationError}
            onRetry={() => setQuotationReload((n) => n + 1)}
          />
          <StatCard
            title="Products"
            icon={<FiBox className="h-5 w-5 text-white" aria-hidden="true" />}
            iconBg="bg-gradient-to-br from-violet-400 to-purple-500"
            total={productTotal}
            totalLabel="total"
            actionableCount={productOutOfStock}
            actionableLabel="out of stock"
            actionableHref="/admin/products?status=OUT_OF_STOCK"
            error={productError}
            onRetry={() => setProductReload((n) => n + 1)}
          />
          <StatCard
            title="Suppliers"
            icon={<FiUsers className="h-5 w-5 text-white" aria-hidden="true" />}
            iconBg="bg-gradient-to-br from-amber-400 to-orange-500"
            total={supplierTotal}
            totalLabel="total"
            actionableCount={supplierActive}
            actionableLabel="active"
            error={supplierError}
            onRetry={() => setSupplierReload((n) => n + 1)}
          />
        </div>
      </section>

      {/* Quick Links Section */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">Quick Links</h2>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <QuickLink
            to="/admin/quotation-requests"
            icon={<FiClipboard aria-hidden="true" />}
            label="Quotation Requests"
            description="Manage customer requests"
          />
          <QuickLink
            to="/admin/orders"
            icon={<FiTruck aria-hidden="true" />}
            label="Orders"
            description="Confirm and track orders"
          />
          <QuickLink
            to="/admin/products"
            icon={<FiBox aria-hidden="true" />}
            label="Products"
            description="Manage product catalog"
          />
          <QuickLink
            to="/admin/suppliers"
            icon={<FiUsers aria-hidden="true" />}
            label="Suppliers"
            description="Manage supplier partners"
          />
          <QuickLink
            to="/admin/categories"
            icon={<FiGrid aria-hidden="true" />}
            label="Categories"
            description="Organize product categories"
          />
          <QuickLink
            to="/admin/customers"
            icon={<FiUsers aria-hidden="true" />}
            label="Customers"
            description="Read-only customer directory"
          />
          <QuickLink
            to="/admin/email-logs"
            icon={<FiMail aria-hidden="true" />}
            label="Email Logs"
            description="Delivery errors and resend"
          />
          <QuickLink
            to="/admin/audit-logs"
            icon={<FiActivity aria-hidden="true" />}
            label="Audit Trail"
            description="Admin action history"
          />
          <QuickLink
            to="/notifications"
            icon={<FiBell aria-hidden="true" />}
            label="Notifications"
            description="Your notification center"
          />
          <QuickLink
            to="/admin/settings"
            icon={<FiSettings aria-hidden="true" />}
            label="Settings"
            description="Configure master settings"
          />        </div>
      </section>
    </div>
  );
}
