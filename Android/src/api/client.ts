import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'http://192.168.1.100:8080'; // ← Your IP

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('pratibimba_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Generic error handler — returns { success: false } on network failure
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      // Network error — return offline indicator
      return Promise.resolve({
        data: { success: false, offline: true, message: 'No connection' },
      });
    }
    return Promise.reject(error);
  }
);

// ── CITIZEN API ───────────────────────────────────────────────
export const citizenAPI = {
  submitRequest: (payload: any) =>
    api.post('/citizen/request', payload).then((r) => r.data),

  getRequestStatus: (requestId: string) =>
    api.get(`/citizen/request/${requestId}`).then((r) => r.data),

  getProfile: (nid: string) =>
    api.get(`/citizen/profile/${nid}`).then((r) => r.data),

  getTaxRecords: (nid: string) =>
    api.get(`/citizen/tax/${nid}`).then((r) => r.data),

  getNotices: (wardCode: string) =>
    api.get(`/citizen/notices/${wardCode}`).then((r) => r.data),

  submitGrievance: (payload: any) =>
    api.post('/citizen/grievance', payload).then((r) => r.data),

  getGrievances: (nid: string) =>
    api.get(`/citizen/grievances/${nid}`).then((r) => r.data),

  bookQueue: (payload: any) =>
    api.post('/citizen/queue/book', payload).then((r) => r.data),

  getBhatta: (nid: string) =>
    api.get(`/citizen/bhatta/${nid}`).then((r) => r.data),

  getDocuments: (nid: string) =>
    api.get(`/citizen/documents/${nid}`).then((r) => r.data),
};

// ── VERIFY API ────────────────────────────────────────────────
export const verifyAPI = {
  verifyDocument: (dtid: string) =>
    api.get(`/verify/${encodeURIComponent(dtid)}`).then((r) => r.data),
};

// ── STATS API ─────────────────────────────────────────────────
export const statsAPI = {
  getStats: () =>
    api.get('/ministry/stats').then((r) => r.data),
  getFeed: (limit = 10) =>
    api.get(`/ministry/feed?limit=${limit}`).then((r) => r.data),
  getLedgerEntries: () =>
    api.get('/ministry/feed?limit=20').then((r) => r.data),
};

// ── DOCUMENT API ──────────────────────────────────────────────
export const documentAPI = {
  getPDFUrl: (dtid: string) => `${API_BASE}/document/pdf/${dtid}`,
};

export default api;