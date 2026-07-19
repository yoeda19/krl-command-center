import { create } from 'zustand';
import type { CriticalStockItem, SlowMovingItem } from '../types';

interface AppState {
  criticalStockData: CriticalStockItem[];
  slowMovingData: SlowMovingItem[];
  isDataLoaded: boolean;
  isLoading: boolean;
  
  setCriticalStockData: (data: CriticalStockItem[]) => void;
  setSlowMovingData: (data: SlowMovingItem[]) => void;
  setIsDataLoaded: (loaded: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  clearCache: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  criticalStockData: [],
  slowMovingData: [],
  isDataLoaded: false,
  isLoading: false,
  
  setCriticalStockData: (data) => set({ criticalStockData: data }),
  setSlowMovingData: (data) => set({ slowMovingData: data }),
  setIsDataLoaded: (loaded) => set({ isDataLoaded: loaded }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  clearCache: () => set({ criticalStockData: [], slowMovingData: [], isDataLoaded: false }),
}));
