import { create } from 'zustand';
import type { CriticalStockItem, SlowMovingItem } from '../types';

interface AppState {
  isAuthenticated: boolean;
  userRole: string;
  criticalStockData: CriticalStockItem[];
  slowMovingData: SlowMovingItem[];
  isDataLoaded: boolean;
  isLoading: boolean;
  
  setCriticalStockData: (data: CriticalStockItem[]) => void;
  setSlowMovingData: (data: SlowMovingItem[]) => void;
  setIsDataLoaded: (loaded: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  login: (authData: any) => void;
  logout: () => void;
  clearCache: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('krl_auth') : false,
  userRole: typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('krl_auth') || '{}').role || 'Admin') : 'Admin',
  criticalStockData: [],
  slowMovingData: [],
  isDataLoaded: false,
  isLoading: false,
  
  setCriticalStockData: (data) => set({ criticalStockData: data }),
  setSlowMovingData: (data) => set({ slowMovingData: data }),
  setIsDataLoaded: (loaded) => set({ isDataLoaded: loaded }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  login: (authData) => {
    localStorage.setItem('krl_auth', JSON.stringify(authData));
    localStorage.setItem('krl_admin_email', authData.email);
    localStorage.setItem('krl_admin_name', authData.name);
    set({ isAuthenticated: true, userRole: authData.role || 'Admin' });
  },
  logout: () => {
    localStorage.removeItem('krl_auth');
    localStorage.removeItem('krl_admin_email');
    localStorage.removeItem('krl_admin_name');
    set({ isAuthenticated: false, userRole: 'Admin', criticalStockData: [], slowMovingData: [], isDataLoaded: false });
  },
  clearCache: () => set({ criticalStockData: [], slowMovingData: [], isDataLoaded: false }),
}));
