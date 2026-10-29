import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api/client';

// Types
export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  customer_type: 'individual' | 'business';
  status: 'active' | 'inactive' | 'suspended';
}

export interface Admin {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'admin' | 'super_admin';
  status: 'active' | 'inactive';
  last_login_at: string | null;
}

interface AuthState {
  user: User | null;
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userType: 'customer' | 'admin' | null;
}

interface AuthContextType extends AuthState {
  login: (phone: string, password: string) => Promise<ApiResponse<{ user: User; token: string }>>;
  register: (data: RegisterData) => Promise<ApiResponse<{ user: User; token: string }>>;
  logout: () => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<ApiResponse<{ admin: Admin; token: string }>>;
  adminLogout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  phone: string;
  email: string;
  company_name?: string;
  password: string;
  password_confirmation: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_TYPE_KEY = 'user_type';
const USER_KEY = 'user_data';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(TOKEN_KEY);
      const userType = localStorage.getItem(USER_TYPE_KEY) as 'customer' | 'admin' | null;
      const userData = localStorage.getItem(USER_KEY);

      if (token && userType && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          return {
            user: userType === 'customer' ? parsedUser : null,
            admin: userType === 'admin' ? parsedUser : null,
            token,
            isAuthenticated: true,
            isLoading: false,
            userType,
          };
        } catch {
          // Invalid stored data
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_TYPE_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
    }

    return {
      user: null,
      admin: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      userType: null,
    };
  });

  // Fetch current user on mount if token exists
  useEffect(() => {
    if (state.token && state.userType) {
      refreshUser();
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const refreshUser = async () => {
    try {
      if (state.userType === 'customer') {
        const response = await apiRequest<{ user: User }>('/auth/user');
        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            user: response.data!.user,
            isAuthenticated: true,
            isLoading: false,
          }));
          localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        } else {
          // Token invalid, clear auth
          clearAuth();
        }
      } else if (state.userType === 'admin') {
        const response = await apiRequest<{ admin: Admin }>('/admin/user');
        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            admin: response.data!.admin,
            isAuthenticated: true,
            isLoading: false,
          }));
          localStorage.setItem(USER_KEY, JSON.stringify(response.data.admin));
        } else {
          clearAuth();
        }
      }
    } catch {
      clearAuth();
    }
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_TYPE_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      admin: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      userType: null,
    });
  };

  const login = async (email: string, password: string) => {
    const response = await apiRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      const { user, token } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_TYPE_KEY, 'customer');
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({
        user,
        admin: null,
        token,
        isAuthenticated: true,
        isLoading: false,
        userType: 'customer',
      });
    }

    return response;
  };

  const register = async (data: RegisterData) => {
    const response = await apiRequest<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      const { user, token } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_TYPE_KEY, 'customer');
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({
        user,
        admin: null,
        token,
        isAuthenticated: true,
        isLoading: false,
        userType: 'customer',
      });
    }

    return response;
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    }
    clearAuth();
  };

  const adminLogin = async (email: string, password: string) => {
    const response = await apiRequest<{ admin: Admin; token: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      const { admin, token } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_TYPE_KEY, 'admin');
      localStorage.setItem(USER_KEY, JSON.stringify(admin));
      setState({
        user: null,
        admin,
        token,
        isAuthenticated: true,
        isLoading: false,
        userType: 'admin',
      });
    }

    return response;
  };

  const adminLogout = async () => {
    try {
      await apiRequest('/admin/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    }
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        adminLogin,
        adminLogout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
