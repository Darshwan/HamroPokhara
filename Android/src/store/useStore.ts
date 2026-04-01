import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteSecureToken, getSecureToken, setSecureToken } from '../utils/secureStorage';

interface Citizen {
  nid: string;
  citizenship_no: string;
  name: string;
  ward_code: string;
}

interface RequestRecord {
  request_id: string;
  document_type: string;
  purpose: string;
  status: string;
  submitted_at: string;
  dtid?: string;
  qr_data?: string;
}

interface AppState {
  // Auth
  isLoggedIn: boolean;
  isGuest: boolean;
  citizen: Citizen | null;
  token: string | null;
  language: string;

  // Requests — stored locally so citizen can track them
  myRequests: RequestRecord[];

  // Actions
  setLanguage: (lang: string) => void;
  continueAsGuest: () => Promise<void>;
  login: (citizen: Citizen, token: string) => Promise<void>;
  logout: () => Promise<void>;
  addRequest: (req: RequestRecord) => Promise<void>;
  updateRequest: (requestId: string, updates: Partial<RequestRecord>) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  isLoggedIn: false,
  isGuest: false,
  citizen: null,
  token: null,
  language: 'ne', // default Nepali
  myRequests: [],

  setLanguage: (lang) => {
    set({ language: lang });
    AsyncStorage.setItem('app_language', lang);
  },

  continueAsGuest: async () => {
    await AsyncStorage.setItem('guest_mode', '1');
    set({ isGuest: true, isLoggedIn: false, citizen: null, token: null });
  },

  login: async (citizen, token) => {
    await setSecureToken(token);
    await AsyncStorage.setItem('citizen_data', JSON.stringify(citizen));
    await AsyncStorage.removeItem('guest_mode');
    set({ isLoggedIn: true, isGuest: false, citizen, token });
  },

  logout: async () => {
    await deleteSecureToken();
    await AsyncStorage.multiRemove(['citizen_data', 'guest_mode']);
    set({ isLoggedIn: false, isGuest: false, citizen: null, token: null });
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

  loadFromStorage: async () => {
    try {
      const [token, citizenStr, requestsStr, lang, guestMode] = await Promise.all([
        getSecureToken(),
        AsyncStorage.getItem('citizen_data'),
        AsyncStorage.getItem('my_requests'),
        AsyncStorage.getItem('app_language'),
        AsyncStorage.getItem('guest_mode'),
      ]);
      set({
        token,
        isLoggedIn: !!token,
        isGuest: !token && guestMode === '1',
        citizen: citizenStr ? JSON.parse(citizenStr) : null,
        myRequests: requestsStr ? JSON.parse(requestsStr) : [],
        language: lang || 'ne',
      });
    } catch (e) {
      console.error('Store load error:', e);
    }
  },
}));