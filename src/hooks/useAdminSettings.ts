import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export type SystemConfig = Record<string, string | number | boolean>;

/** Réponse GET /admin-settings — le client HTTP ne renvoie que `data` */
type AdminSettingsPayload = {
  editable?: SystemConfig;
  readOnly?: Record<string, unknown>;
  audit?: { lastUpdatedAt?: string | null; appVersion?: string };
};

type PatchAdminSettingsPayload = {
  editable?: SystemConfig;
  lastUpdatedAt?: string | null;
};

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
      const res = await api.get<AdminSettingsPayload | SystemConfig>('/admin-settings');
      const cfg =
        res && typeof res === 'object' && 'editable' in res && (res as AdminSettingsPayload).editable
          ? (res as AdminSettingsPayload).editable!
          : (res as SystemConfig);
      setConfig(cfg && typeof cfg === 'object' ? cfg : {});
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
      const res = await api.patch<PatchAdminSettingsPayload>('/admin-settings', updates);
      if (res?.editable && typeof res.editable === 'object') {
        setConfig(res.editable);
      } else {
        setConfig(prev => ({ ...prev, ...updates }));
      }
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
