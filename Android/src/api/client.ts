import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'http://192.168.100.44:8080'; // ← Your IP

const REQUEST_TIMEOUT_MS = 15000;
const AUTH_LOG_TAG = '[AuthAPI]';

const isAuthPath = (path: string) => path.startsWith('/auth/');

const summarizePayload = (body: any) => {
  if (body === undefined || body === null) return { kind: 'none' };
  if (body instanceof FormData) return { kind: 'form-data' };
  if (typeof body !== 'object') return { kind: typeof body };

  const entries = Object.keys(body).map((key) => {
    const raw = body[key];
    const value = typeof raw === 'string' ? `[len:${raw.length}]` : raw === undefined || raw === null ? 'empty' : typeof raw;
    return [key, value];
  });

  return {
    kind: 'json',
    fields: Object.fromEntries(entries),
  };
};

const withTimeout = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : {};
};

const request = async (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: any,
  headers?: Record<string, string>
) => {
  const authRoute = isAuthPath(path);
  const startedAt = Date.now();

  if (authRoute) {
    console.info(`${AUTH_LOG_TAG} request:start`, {
      method,
      path,
      payload: summarizePayload(body),
    });
  }

  const token = await AsyncStorage.getItem('pratibimba_token');
  const normalizedHeaders: Record<string, string> = {
    ...(headers || {}),
  };

  if (token) {
    normalizedHeaders.Authorization = `Bearer ${token}`;
  }

  if (body && !(body instanceof FormData) && !normalizedHeaders['Content-Type']) {
    normalizedHeaders['Content-Type'] = 'application/json';
  }

  const init: RequestInit = {
    method,
    headers: normalizedHeaders,
  };

  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const response = await withTimeout(`${API_BASE}${path}`, init);
    const data = await parseResponseBody(response);

    if (!response.ok) {
      if (authRoute) {
        console.warn(`${AUTH_LOG_TAG} request:failed`, {
          method,
          path,
          status: response.status,
          durationMs: Date.now() - startedAt,
          message: (data as any)?.message || 'Request failed',
        });
      }
      return { success: false, status: response.status, ...(data || {}) };
    }

    if (authRoute) {
      console.info(`${AUTH_LOG_TAG} request:success`, {
        method,
        path,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
    }

    return data;
  } catch {
    if (authRoute) {
      console.error(`${AUTH_LOG_TAG} request:offline-or-timeout`, {
        method,
        path,
        durationMs: Date.now() - startedAt,
      });
    }
    return { success: false, offline: true, message: 'No connection' };
  }
};

const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, payload?: any, customHeaders?: Record<string, string>) =>
    request('POST', path, payload, customHeaders),
  put: (path: string, payload?: any) => request('PUT', path, payload),
  patch: (path: string, payload?: any) => request('PATCH', path, payload),
  delete: (path: string) => request('DELETE', path),
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await withTimeout(`${API_BASE}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

export const authAPI = {
  loginCitizen: (nid: string, citizenship_no: string) =>
    api.post('/auth/citizen/login', { nid, citizenship_no }),

  loginTourist: (payload: {
    passport_no: string;
    full_name?: string;
    nationality?: string;
    device_info?: string;
  }) => api.post('/auth/tourist/login', payload),

  loginWithScannedDocument: (
    docType: 'nid' | 'citizenship' | 'license' | 'passport',
    imageUri: string,
    documentNumber?: string
  ) => {
    const formData = new FormData();
    formData.append('doc_type', docType);
    if (documentNumber) {
      formData.append('document_number', documentNumber);
    }
    formData.append('file', {
      uri: imageUri,
      name: 'document.jpg',
      type: 'image/jpeg',
    } as any);
    return api.post('/auth/citizen/login-by-scan', formData);
  },

  scanIdentityDocument: (
    docType: 'nid' | 'citizenship' | 'license' | 'passport',
    imageUri: string,
    documentNumber?: string
  ) => {
    const formData = new FormData();
    formData.append('doc_type', docType);
    if (documentNumber) {
      formData.append('document_number', documentNumber);
    }
    formData.append('file', {
      uri: imageUri,
      name: 'document.jpg',
      type: 'image/jpeg',
    } as any);
    return api.post('/auth/ocr/identity', formData);
  },

  scanOcrDocument: (payload: {
    image_base64: string;
    document_type: 'citizenship' | 'nid' | 'license' | 'passport';
    language?: 'ne' | 'en';
  }) => api.post('/auth/ocr', payload),

  startGuest: () => api.post('/auth/guest/start', {}),
};

// ── CITIZEN API ───────────────────────────────────────────────
export const citizenAPI = {
  submitRequest: (payload: any) =>
    api.post('/citizen/request', payload),

  getRequestStatus: (requestId: string) =>
    api.get(`/citizen/request/${requestId}`),

  getProfile: (nid: string) =>
    api.get(`/citizen/profile/${nid}`),

  getTaxRecords: (nid: string) =>
    api.get(`/citizen/tax/${nid}`),

  getNotices: (wardCode: string) =>
    api.get(`/citizen/notices/${wardCode}`),

  submitGrievance: (payload: any) =>
    api.post('/citizen/grievance', payload),

  getGrievances: (nid: string) =>
    api.get(`/citizen/grievances/${nid}`),

  bookQueue: (payload: any) =>
    api.post('/citizen/queue/book', payload),

  getBhatta: (nid: string) =>
    api.get(`/citizen/bhatta/${nid}`),

  getDocuments: (nid: string) =>
    api.get(`/citizen/documents/${nid}`),
};

// ── VERIFY API ────────────────────────────────────────────────
export const verifyAPI = {
  verifyDocument: (dtid: string) =>
    api.get(`/verify/${encodeURIComponent(dtid)}`),
};

// ── STATS API ─────────────────────────────────────────────────
export const statsAPI = {
  getStats: () =>
    api.get('/ministry/stats'),
  getFeed: (limit = 10) =>
    api.get(`/ministry/feed?limit=${limit}`),
  getLedgerEntries: () =>
    api.get('/ministry/feed?limit=20'),
};

// ── WEATHER API (OPEN-METEO) ────────────────────────────────
export const weatherAPI = {
  getPokharaWeather: async () => {
    const lat = 28.2096;
    const lon = 83.9856;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,relative_humidity_2m,visibility&daily=uv_index_max&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;

    try {
      const [weatherRes, aqiRes] = await Promise.all([
        withTimeout(weatherUrl, { method: 'GET' }),
        withTimeout(aqiUrl, { method: 'GET' }),
      ]);

      if (!weatherRes.ok || !aqiRes.ok) {
        return { success: false, message: 'Unable to fetch weather data' };
      }

      const weatherData = await weatherRes.json();
      const aqiData = await aqiRes.json();

      return {
        success: true,
        weather: {
          temperature: weatherData?.current?.temperature_2m,
          weatherCode: weatherData?.current?.weather_code,
          isDay: Boolean(weatherData?.current?.is_day),
          humidity: weatherData?.current?.relative_humidity_2m,
          visibilityMeters: weatherData?.current?.visibility,
          uvIndexMax: weatherData?.daily?.uv_index_max?.[0],
          aqi: aqiData?.current?.us_aqi,
        },
      };
    } catch {
      return { success: false, message: 'Unable to fetch weather data' };
    }
  },
};

// ── AI ASSISTANT API ─────────────────────────────────────────
export const aiAPI = {
  askGovernmentAssistant: (payload: {
    query: string;
    language: 'ne' | 'en';
    context?: string;
    citizen_nid?: string;
    tourist_passport?: string;
  }) => api.post('/ai/government-assistant', payload),

  logChatQuery: (payload: {
    query: string;
    language: 'ne' | 'en';
    answer?: string;
    source?: 'claude' | 'template' | 'offline';
    context?: string;
    user_id?: string;
  }) => api.post('/ai_chat_log', payload),
};

// ── DOCUMENT API ──────────────────────────────────────────────
export const documentAPI = {
  getPDFUrl: (dtid: string) => `${API_BASE}/document/pdf/${dtid}`,
};

// ── PAYMENT API ─────────────────────────────────────────────
export const paymentAPI = {
  createEsewaOrder: (payload: {
    service_type: 'electricity' | 'water' | 'tax';
    account_ref: string;
    amount: number;
    phone?: string;
    citizen_nid?: string;
  }) => api.post('/payments/esewa/create', payload),

  verifyEsewaOrder: (payload: {
    order_id: string;
    transaction_uuid?: string;
    ref_id?: string;
  }) => api.post('/payments/esewa/verify', payload),
};

export default api;