import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ApiMode = 'proxy' | 'direct';

interface SettingsState {
  apiMode: ApiMode;
  apiKey: string;
  proxyUrl: string;

  // Actions
  setApiMode: (mode: ApiMode) => void;
  setApiKey: (key: string) => void;
  setProxyUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiMode: 'proxy',
      apiKey: '',
      proxyUrl: 'https://api.anthropic.com',

      setApiMode: (mode) => set({ apiMode: mode }),
      setApiKey: (key) => set({ apiKey: key }),
      setProxyUrl: (url) => set({ proxyUrl: url }),
    }),
    {
      name: 'makecc-settings',
    }
  )
);
