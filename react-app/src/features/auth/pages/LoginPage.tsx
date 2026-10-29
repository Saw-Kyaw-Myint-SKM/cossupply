import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';

/**
 * Customer Login Page
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    const response = await login(formData.phone, formData.password);

    setIsLoading(false);

    if (response.success) {
      navigate('/dashboard');
    } else {
      setError(response.message || 'Login failed');
      if (response.errors) {
        setFieldErrors(response.errors);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="glass-card p-8">
        <h1 className="text-2xl font-bold text-ink mb-6 text-center">
          Customer Login
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-ink mb-1">
              Phone Number
            </label>
            <input
              type="text"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-line rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              placeholder="09xxxxxxxxx"
              required
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.phone[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-line rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password[0]}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-1.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-accent hover:text-accent/80">
              Register here
            </Link>
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-rule">
          <p className="text-sm text-subtle text-center">
            Admin?{' '}
            <Link to="/admin/login" className="font-medium text-ink hover:text-ink">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
