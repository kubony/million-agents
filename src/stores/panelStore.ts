import { create } from 'zustand';
import type { PanelTab } from '../types/workflow';

interface PanelState {
  activeTab: PanelTab;
  isCollapsed: boolean;
  width: number;

  // Actions
  setActiveTab: (tab: PanelTab) => void;
  toggleCollapsed: () => void;
  setWidth: (width: number) => void;
  openStepPanel: () => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  activeTab: 'preview',
  isCollapsed: false,
  width: 400,

  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setWidth: (width) => set({ width: Math.max(300, Math.min(600, width)) }),
  openStepPanel: () => set({ activeTab: 'step', isCollapsed: false }),
}));
