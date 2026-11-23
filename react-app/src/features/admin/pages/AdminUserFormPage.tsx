import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ADMIN_USER_FIELDS,
  createAdminUser,
  getAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
} from '../api/adminUsersApi';
import { mapValidationErrors } from '../api/catalogApiUtils';
import {
  Alert,
  Field,
  LoadingPanel,
  PageHeader,
  describeLoadError,
  describeRequestError,
  inputClass,
  joinIds,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  type LoadErrorState,
} from '../../../components/catalog-ui/CatalogUi';
import { useToast } from '../../../components/ui/Toast';

interface AdminUserFormState {
  name: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  password: string;
}

const EMPTY_FORM: AdminUserFormState = {
  name: '',
  email: '',
  phone: '',
  role: 'admin',
  status: 'active',
  password: '',
};

function fieldId(key: string): string {
  return `admin-user-${key}`;
}

function fieldErrorId(key: string): string {
  return `${fieldId(key)}-error`;
}

function toFormState(adminUser: AdminUser): AdminUserFormState {
  return {
    name: adminUser.name,
    email: adminUser.email,
    phone: adminUser.phone ?? '',
    role: adminUser.role,
    status: adminUser.status,
    password: '',
  };
}

/**
 * Create and edit share this component: `/admin/admin-users/new` has no
 * route param, `/admin/admin-users/:id/edit` loads the account first.
 *
 * The password is only collected on create; on edit it is changed through
 * the separate "Reset password" form, which calls the dedicated endpoint.
 */
export default function AdminUserFormPage() {
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const rawId = params.id;
  const adminUserId = rawId === undefined ? null : Number(rawId);
  const isEdit = adminUserId !== null;

  const [form, setForm] = useState<AdminUserFormState>(EMPTY_FORM);
  const [current, setCurrent] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<LoadErrorState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetFieldErrors, setResetFieldErrors] = useState<Record<string, string[]>>({});

  const formAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (rawId === undefined) {
        setForm(EMPTY_FORM);
        setCurrent(null);
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      if (adminUserId === null || !Number.isInteger(adminUserId) || adminUserId <= 0) {
        setLoadError({
          message: 'That admin user link is not valid. Open a user from the list.',
          needsLogin: false,
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      const response = await getAdminUser(adminUserId);

      if (cancelled) return;

      if (response.success && response.data) {
        setCurrent(response.data.admin_user);
        setForm(toFormState(response.data.admin_user));
      } else if (response.status === 404) {
        setLoadError({
          message: 'That admin user could not be found. It may have been deleted.',
          needsLogin: false,
        });
      } else {
        setLoadError(describeLoadError(response, 'this admin user'));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [adminUserId, rawId, reloadToken]);

  const clearFieldError = (key: string) => {
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const updateField = <K extends keyof AdminUserFormState>(
    key: K,
    value: AdminUserFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFormError(null);
    clearFieldError(key);
  };

  const focusFirstError = (errors: Record<string, string[]>) => {
    const firstKey = Object.keys(errors)[0];

    requestAnimationFrame(() => {
      if (firstKey) {
        document.getElementById(fieldId(firstKey))?.focus();
        return;
      }
      formAlertRef.current?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving || isLoading) return;

    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});

    const response =
      adminUserId === null
        ? await createAdminUser({
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            status: form.status,
            password: form.password,
          })
        : await updateAdminUser(adminUserId, {
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            status: form.status,
          });

    setIsSaving(false);

    if (response.success && response.data) {
      const adminUser = response.data.admin_user;

      if (adminUserId === null) {
        showToast({
          tone: 'success',
          title: 'Admin user created.',
          description: `“${adminUser.name}” can now sign in to the admin panel.`,
        });

        navigate(`/admin/admin-users/${adminUser.id}/edit`, { replace: true });
        return;
      }

      setCurrent(adminUser);
      setForm(toFormState(adminUser));
      showToast({
        tone: 'success',
        title: 'Admin user updated.',
        description: `“${adminUser.name}” is up to date.`,
      });
      return;
    }

    const mapped = mapValidationErrors(response.errors, ADMIN_USER_FIELDS);
    setFieldErrors(mapped.fieldErrors);
    setFormError(
      mapped.formErrors[0] ?? describeRequestError(response, 'The admin user could not be saved.'),
    );
    focusFirstError(mapped.fieldErrors);
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isResetting || adminUserId === null) return;

    setIsResetting(true);
    setResetError(null);
    setResetFieldErrors({});

    const response = await resetAdminUserPassword(adminUserId, newPassword);

    setIsResetting(false);

    if (response.success) {
      setNewPassword('');
      showToast({
        tone: 'success',
        title: 'Password reset.',
        description: `“${current?.name ?? 'This admin user'}” must use the new password next time they sign in. Their existing sessions were signed out.`,
      });
      return;
    }

    const mapped = mapValidationErrors(response.errors, ['password']);
    setResetFieldErrors(mapped.fieldErrors);
    setResetError(
      mapped.formErrors[0] ?? describeRequestError(response, 'The password could not be reset.'),
    );
  };

  const header = (
    <PageHeader
      title={isEdit ? 'Edit admin user' : 'New admin user'}
      description={
        isEdit
          ? current
            ? `Updating “${current.name}”.`
            : 'Update this admin account.'
          : 'Give someone access to the CoSupply admin panel.'
      }
      action={
        <Link to="/admin/admin-users" className={secondaryButtonClass}>
          Back to admin users
        </Link>
      }
    />
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-semibold text-red-800">Admin user is unavailable</h2>
          <p className="mt-1 text-sm text-red-700">{loadError.message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {loadError.needsLogin ? (
              <Link to="/admin/login" className={linkClass}>
                Go to admin login
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className={primaryButtonClass}
              >
                Try again
              </button>
            )}
            <Link to="/admin/admin-users" className={linkClass}>
              Back to admin users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading admin user…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {formError ? (
        <div
          ref={formAlertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <p className="text-sm font-medium text-red-700">{formError}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isSaving || undefined}>
        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Account details</h2>
            <p className="mt-1 text-sm text-gray-500">
              The email address is the sign-in name and must be unique.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Full name" htmlFor={fieldId('name')} required error={fieldErrors.name}>
                <input
                  id={fieldId('name')}
                  type="text"
                  required
                  maxLength={255}
                  value={form.name}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.name) || undefined}
                  aria-describedby={joinIds(Boolean(fieldErrors.name) && fieldErrorId('name'))}
                  onChange={(event) => updateField('name', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.name))}
                />
              </Field>

              <Field
                label="Email"
                htmlFor={fieldId('email')}
                required
                error={fieldErrors.email}
                hint="Used to sign in to the admin panel."
                hintId={`${fieldId('email')}-hint`}
              >
                <input
                  id={fieldId('email')}
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.email) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('email')}-hint`,
                    Boolean(fieldErrors.email) && fieldErrorId('email'),
                  )}
                  onChange={(event) => updateField('email', event.target.value)}
                  className={inputClass(Boolean(fieldErrors.email))}
                />
              </Field>
            </div>

            <Field
              label="Phone"
              htmlFor={fieldId('phone')}
              error={fieldErrors.phone}
              hint="Optional. Shown to other admins for contact."
              hintId={`${fieldId('phone')}-hint`}
            >
              <input
                id={fieldId('phone')}
                type="text"
                maxLength={30}
                value={form.phone}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.phone) || undefined}
                aria-describedby={joinIds(
                  `${fieldId('phone')}-hint`,
                  Boolean(fieldErrors.phone) && fieldErrorId('phone'),
                )}
                onChange={(event) => updateField('phone', event.target.value)}
                className={`${inputClass(Boolean(fieldErrors.phone))} max-w-xs`}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Access</h2>
            <p className="mt-1 text-sm text-gray-500">
              Only super admins can manage admin users. Set the status to Inactive to block
              sign-in without deleting the account.
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Role"
                htmlFor={fieldId('role')}
                required
                error={fieldErrors.role}
                hint="Super admin: full access, including this page."
                hintId={`${fieldId('role')}-hint`}
              >
                <select
                  id={fieldId('role')}
                  required
                  value={form.role}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.role) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('role')}-hint`,
                    Boolean(fieldErrors.role) && fieldErrorId('role'),
                  )}
                  onChange={(event) => updateField('role', event.target.value as AdminUserRole)}
                  className={`${inputClass(Boolean(fieldErrors.role))} max-w-xs`}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </Field>

              <Field
                label="Status"
                htmlFor={fieldId('status')}
                required
                error={fieldErrors.status}
                hint="Inactive accounts keep their data but cannot sign in."
                hintId={`${fieldId('status')}-hint`}
              >
                <select
                  id={fieldId('status')}
                  required
                  value={form.status}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.status) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('status')}-hint`,
                    Boolean(fieldErrors.status) && fieldErrorId('status'),
                  )}
                  onChange={(event) =>
                    updateField('status', event.target.value as AdminUserStatus)
                  }
                  className={`${inputClass(Boolean(fieldErrors.status))} max-w-xs`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>

            {!isEdit ? (
              <Field
                label="Password"
                htmlFor={fieldId('password')}
                required
                error={fieldErrors.password}
                hint="At least 8 characters. Shared with the new user through a safe channel."
                hintId={`${fieldId('password')}-hint`}
              >
                <input
                  id={fieldId('password')}
                  type="password"
                  required
                  minLength={8}
                  maxLength={1000}
                  autoComplete="new-password"
                  value={form.password}
                  disabled={isSaving}
                  aria-invalid={Boolean(fieldErrors.password) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('password')}-hint`,
                    Boolean(fieldErrors.password) && fieldErrorId('password'),
                  )}
                  onChange={(event) => updateField('password', event.target.value)}
                  className={`${inputClass(Boolean(fieldErrors.password))} max-w-md`}
                />
              </Field>
            ) : null}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow">
          <p className="text-sm text-gray-600" aria-live="polite">
            {isSaving
              ? 'Saving changes…'
              : isEdit
                ? 'Save to apply your changes.'
                : 'The admin user is created once you save.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/admin-users" className={secondaryButtonClass}>
              Cancel
            </Link>
            <button type="submit" disabled={isSaving} className={primaryButtonClass}>
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create admin user'}
            </button>
          </div>
        </div>
      </form>

      {isEdit && current ? (
        <form onSubmit={handleResetPassword} className="space-y-4" aria-busy={isResetting || undefined}>
          <section className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sets a new sign-in password for {current.name} and signs their other sessions
                out. The current password is never shown here.
              </p>
            </div>
            <div className="space-y-5 px-6 py-5">
              {resetError ? (
                <Alert tone="error">
                  <p className="text-sm font-medium">{resetError}</p>
                </Alert>
              ) : null}

              <Field
                label="New password"
                htmlFor={fieldId('new-password')}
                required
                error={resetFieldErrors.password}
                hint="At least 8 characters."
                hintId={`${fieldId('new-password')}-hint`}
              >
                <input
                  id={fieldId('new-password')}
                  type="password"
                  required
                  minLength={8}
                  maxLength={1000}
                  autoComplete="new-password"
                  value={newPassword}
                  disabled={isResetting}
                  aria-invalid={Boolean(resetFieldErrors.password) || undefined}
                  aria-describedby={joinIds(
                    `${fieldId('new-password')}-hint`,
                    Boolean(resetFieldErrors.password) && fieldErrorId('new-password'),
                  )}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setResetError(null);
                    setResetFieldErrors({});
                  }}
                  className={`${inputClass(Boolean(resetFieldErrors.password))} max-w-md`}
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow">
            <p className="text-sm text-gray-600" aria-live="polite">
              {isResetting ? 'Resetting password…' : 'Changes here do not affect the form above.'}
            </p>
            <button type="submit" disabled={isResetting} className={primaryButtonClass}>
              {isResetting ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
