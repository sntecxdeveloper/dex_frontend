import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

/** Check if a string looks like a valid JWT (has exactly 2 dots). */
function isValidJwtFormat(token: string): boolean {
  return token.split('.').length === 3;
}

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dex_token');
  if (token && isValidJwtFormat(token)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 with auto token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, attempt refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('dex_refresh_token');

      if (!refreshToken || !isValidJwtFormat(refreshToken)) {
        // No valid refresh token — force logout
        localStorage.removeItem('dex_token');
        localStorage.removeItem('dex_user');
        localStorage.removeItem('dex_refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post('/api/v1/auth/refresh', {
          refreshToken,
        });

        const { token } = response.data.data;

        if (token && isValidJwtFormat(token)) {
          localStorage.setItem('dex_token', token);
          processQueue(null, token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } else {
          processQueue(new Error('Invalid token received'), null);
          localStorage.removeItem('dex_token');
          localStorage.removeItem('dex_user');
          localStorage.removeItem('dex_refresh_token');
          window.location.href = '/login';
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Refresh failed — force logout
        localStorage.removeItem('dex_token');
        localStorage.removeItem('dex_user');
        localStorage.removeItem('dex_refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
