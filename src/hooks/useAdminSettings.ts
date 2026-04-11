import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export type SystemConfig = Record<string, string | number | boolean>;

export function useAdminSettings(enabled = true) {
  const [config, setConfig] = useState<SystemConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ config?: SystemConfig } | SystemConfig>('/admin-settings');
      const cfg = (res && typeof res === 'object' && 'config' in res)
        ? (res as { config: SystemConfig }).config
        : (res as SystemConfig);
      setConfig(cfg ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const save = useCallback(async (updates: SystemConfig): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/admin-settings', updates);
      setConfig(prev => ({ ...prev, ...updates }));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de sauvegarder');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { config, loading, saving, error, save, refetch: load };
}
