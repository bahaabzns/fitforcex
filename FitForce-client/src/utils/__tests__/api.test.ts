// API utilities for testing
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders;
  }

  async get<T>(endpoint: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { ...this.defaultHeaders, ...headers },
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : data.message || 'Request failed',
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        statusCode: 0,
      };
    }
  }

  async post<T>(endpoint: string, body: any, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.defaultHeaders,
          ...headers,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : data.message || 'Request failed',
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        statusCode: 0,
      };
    }
  }
}

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}

export function parseApiError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  return 'An unexpected error occurred';
}

// Tests
describe('API Utilities', () => {
  describe('ApiClient', () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient('https://api.example.com', {
        'Authorization': 'Bearer token123',
      });
    });

    describe('get', () => {
      it('should make GET requests with correct headers', async () => {
        // Mock fetch
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        });

        const result = await apiClient.get('/users');

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/users',
          {
            method: 'GET',
            headers: { 'Authorization': 'Bearer token123' },
          }
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ data: 'test' });
        expect(result.statusCode).toBe(200);
      });

      it('should handle GET request errors', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: jest.fn().mockResolvedValue({ message: 'Not found' }),
        });

        const result = await apiClient.get('/users');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Not found');
        expect(result.statusCode).toBe(404);
      });

      it('should handle network errors', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        const result = await apiClient.get('/users');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
        expect(result.statusCode).toBe(0);
      });
    });

    describe('post', () => {
      it('should make POST requests with correct data', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: jest.fn().mockResolvedValue({ id: 1, name: 'John' }),
        });

        const result = await apiClient.post('/users', { name: 'John' });

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/users',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer token123',
            },
            body: JSON.stringify({ name: 'John' }),
          }
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 1, name: 'John' });
        expect(result.statusCode).toBe(201);
      });

      it('should handle POST request errors', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValue({ message: 'Validation error' }),
        });

        const result = await apiClient.post('/users', { name: '' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation error');
        expect(result.statusCode).toBe(400);
      });
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const params = { name: 'John', age: 30, active: true };
      const result = buildQueryString(params);
      expect(result).toBe('name=John&age=30&active=true');
    });

    it('should handle undefined and null values', () => {
      const params = { name: 'John', age: undefined, active: null, status: 'active' };
      const result = buildQueryString(params);
      expect(result).toBe('name=John&status=active');
    });

    it('should handle empty object', () => {
      const result = buildQueryString({});
      expect(result).toBe('');
    });

    it('should URL encode special characters', () => {
      const params = { search: 'hello world', special: 'a+b=c' };
      const result = buildQueryString(params);
      expect(result).toBe('search=hello+world&special=a%2Bb%3Dc');
    });
  });

  describe('parseApiError', () => {
    it('should parse string errors', () => {
      expect(parseApiError('Simple error')).toBe('Simple error');
    });

    it('should parse Error objects', () => {
      const error = new Error('Error message');
      expect(parseApiError(error)).toBe('Error message');
    });

    it('should parse API response errors', () => {
      const error = {
        response: {
          data: {
            message: 'API error message'
          }
        }
      };
      expect(parseApiError(error)).toBe('API error message');
    });

    it('should handle unknown error formats', () => {
      expect(parseApiError({})).toBe('An unexpected error occurred');
      expect(parseApiError(null)).toBe('An unexpected error occurred');
      expect(parseApiError(undefined)).toBe('An unexpected error occurred');
    });
  });
});

