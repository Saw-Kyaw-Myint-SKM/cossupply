/**
 * API Types for CoSupply
 */

// User types
export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  company_name: string | null;
  customer_type: 'individual' | 'business';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'super_admin';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// Auth types
export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  email?: string;
  password: string;
  password_confirmation: string;
  company_name?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminAuthResponse {
  admin: Admin;
  token: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}
