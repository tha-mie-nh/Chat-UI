import { useState, useCallback } from 'react';
import { DEFAULT_CONFIG, type ChatConfig } from '../types/chat';

const STORAGE_KEY = 'chatui_config';

function loadConfig(): ChatConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: ChatConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useConfig() {
  const [config, setConfig] = useState<ChatConfig>(loadConfig);

  const updateConfig = useCallback((updates: Partial<ChatConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      saveConfig(next);
      return next;
    });
  }, []);

  return { config, updateConfig };
}
