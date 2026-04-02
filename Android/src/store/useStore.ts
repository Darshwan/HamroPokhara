import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteSecureToken, getSecureToken, setSecureToken } from '../utils/secureStorage';

interface Citizen {
  nid: string;
  citizenship_no: string;
  name: string;
  ward_code: string;
}

interface Tourist {
  passport_no: string;
  name: string;
  nationality: string;
}

interface RequestRecord {
  request_id: string;
  document_type: string;
  purpose: string;
  status: string;
  submitted_at: string;
  dtid?: string;
  qr_data?: string;
  category?: 'citizen' | 'tourist';
  details?: string;
}

interface AppState {
  // Auth
  isLoggedIn: boolean;
  isGuest: boolean;
  isTourist: boolean;
  citizen: Citizen | null;
  tourist: Tourist | null;
  token: string | null;
  language: string;

  // Requests — stored locally so citizen can track them
  myRequests: RequestRecord[];

  // OCR cache — used to prefill login/request forms after a verified scan
  lastOcrScan: Record<string, any> | null;

  // Actions
  setLanguage: (lang: string) => void;
  continueAsGuest: () => Promise<void>;
  loginAsTourist: (tourist: Tourist, token: string) => Promise<void>;
  login: (citizen: Citizen, token: string) => Promise<void>;
  logout: () => Promise<void>;
  addRequest: (req: RequestRecord) => Promise<void>;
  updateRequest: (requestId: string, updates: Partial<RequestRecord>) => Promise<void>;
  setLastOcrScan: (scan: Record<string, any> | null) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  isLoggedIn: false,
  isGuest: false,
  isTourist: false,
  citizen: null,
  tourist: null,
  token: null,
  language: 'ne', // default Nepali
  myRequests: [],
  lastOcrScan: null,

  setLanguage: (lang) => {
    set({ language: lang });
    AsyncStorage.setItem('app_language', lang);
  },

  continueAsGuest: async () => {
    await AsyncStorage.setItem('guest_mode', '1');
    await AsyncStorage.removeItem('tourist_mode');
    await AsyncStorage.removeItem('tourist_data');
    set({ isGuest: true, isTourist: false, isLoggedIn: false, citizen: null, tourist: null, token: null });
  },

  loginAsTourist: async (tourist, token) => {
    await setSecureToken(token);
    await AsyncStorage.setItem('tourist_data', JSON.stringify(tourist));
    await AsyncStorage.setItem('tourist_mode', '1');
    await AsyncStorage.removeItem('guest_mode');
    await AsyncStorage.removeItem('citizen_data');
    set({ isLoggedIn: false, isGuest: false, isTourist: true, citizen: null, tourist, token });
  },

  login: async (citizen, token) => {
    await setSecureToken(token);
    await AsyncStorage.setItem('citizen_data', JSON.stringify(citizen));
    await AsyncStorage.removeItem('guest_mode');
    await AsyncStorage.removeItem('tourist_mode');
    await AsyncStorage.removeItem('tourist_data');
    set({ isLoggedIn: true, isGuest: false, isTourist: false, citizen, tourist: null, token });
  },

  logout: async () => {
    await deleteSecureToken();
    await AsyncStorage.multiRemove(['citizen_data', 'guest_mode', 'tourist_mode', 'tourist_data']);
    set({ isLoggedIn: false, isGuest: false, isTourist: false, citizen: null, tourist: null, token: null });
  },

  addRequest: async (req) => {
    const current = get().myRequests;
    const updated = [req, ...current];
    await AsyncStorage.setItem('my_requests', JSON.stringify(updated));
    set({ myRequests: updated });
  },

  updateRequest: async (requestId, updates) => {
    const current = get().myRequests;
    const updated = current.map(r =>
      r.request_id === requestId ? { ...r, ...updates } : r
    );
    await AsyncStorage.setItem('my_requests', JSON.stringify(updated));
    set({ myRequests: updated });
  },

  setLastOcrScan: async (scan) => {
    if (scan) {
      await AsyncStorage.setItem('last_ocr_scan', JSON.stringify(scan));
    } else {
      await AsyncStorage.removeItem('last_ocr_scan');
    }
    set({ lastOcrScan: scan });
  },

  loadFromStorage: async () => {
    try {
      const [token, citizenStr, requestsStr, lang, guestMode, touristMode, touristStr, lastOcrScanStr] = await Promise.all([
        getSecureToken(),
        AsyncStorage.getItem('citizen_data'),
        AsyncStorage.getItem('my_requests'),
        AsyncStorage.getItem('app_language'),
        AsyncStorage.getItem('guest_mode'),
        AsyncStorage.getItem('tourist_mode'),
        AsyncStorage.getItem('tourist_data'),
        AsyncStorage.getItem('last_ocr_scan'),
      ]);
      set({
        token,
        isLoggedIn: !!token && touristMode !== '1' && guestMode !== '1',
        isGuest: !token && guestMode === '1',
        isTourist: touristMode === '1',
        citizen: citizenStr ? JSON.parse(citizenStr) : null,
        tourist: touristStr ? JSON.parse(touristStr) : null,
        myRequests: requestsStr ? JSON.parse(requestsStr) : [],
        language: lang || 'ne',
        lastOcrScan: lastOcrScanStr ? JSON.parse(lastOcrScanStr) : null,
      });
    } catch (e) {
      console.error('Store load error:', e);
    }
  },
}));