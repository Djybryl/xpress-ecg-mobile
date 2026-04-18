import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface EconomyGate {
  allowed: boolean;
  remaining?: number;
  mode: 'subscription' | 'user_quota' | 'premium_unmetered' | 'no_limit';
  reason?: string;
  code?: string;
}

export interface EconomyQuota {
  ecg_used: number;
  ecg_limit: number;
}

export interface EconomySubscription {
  plan: string;
  status: string;
  monthly_ecg_quota: number;
  ecg_used_this_month: number;
}

export interface EconomyData {
  monthYear: string;
  /** Établissement rattaché (profil utilisateur) */
  hospitalId: string | null;
  accessLevel: 'GRATUIT' | 'PREMIUM';
  gate: EconomyGate;
  quota: EconomyQuota | null;
  subscription: EconomySubscription | null;
}

export function useEconomyMe(enabled = true) {
  const [data, setData] = useState<EconomyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.get<EconomyData>('/economy/me');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur quota');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
