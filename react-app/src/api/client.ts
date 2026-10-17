/**
 * API Client for CoSupply
 * 
 * This module provides a configured fetch wrapper for all API calls.
 * The base URL is loaded from environment variables.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  /** HTTP status of the response; undefined when the request never reached the server. */
  status?: number;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * Make an API request with proper error handling
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // When the body is FormData the browser must set the Content-Type header
  // itself so the generated multipart boundary is included; a hard-coded
  // application/json header would break multipart parsing on the server.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  // Add authorization header if token exists
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include',
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'An error occurred',
        errors: data.errors,
        status: response.status,
      };
    }

    return { ...data, status: response.status };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<ApiResponse<{
  status: string;
  timestamp: string;
  timezone: string;
}>> {
  return apiRequest('/health');
}

export { API_BASE_URL };
