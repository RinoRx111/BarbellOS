const BASE_URL = 'http://localhost:8000/api';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    
    let responseData: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const errorMsg = responseData?.detail || responseData || response.statusText;
      throw new ApiError(response.status, typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    return responseData as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Network error or connection failed');
  }
}

export const api = {
  setToken: (token: string | null) => {
    authToken = token;
  },
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }),
  put: <T>(endpoint: string, body?: any) => request<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
export default api;

