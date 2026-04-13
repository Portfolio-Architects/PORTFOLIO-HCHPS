import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  
  activeModal: string | null;
  activeModalData: any | null;
  openModal: (modalName: string, data?: any) => void;
  closeModal: () => void;
  
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  activeModal: null,
  activeModalData: null,
  openModal: (modalName, data = null) => set({ activeModal: modalName, activeModalData: data }),
  closeModal: () => set({ activeModal: null, activeModalData: null }),
  
  activeTab: 'workspace',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
