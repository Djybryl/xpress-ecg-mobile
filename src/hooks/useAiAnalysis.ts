/**
 * Hook pour récupérer la suggestion IA d'un ECG (GET /ecg-records/:id/ai/analysis).
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface AiAnalysisPublic {
  id: string;
  ecg_record_id: string;
  status: 'pending' | 'processing' | 'partial' | 'completed' | 'failed';
  triage: string | null;
  pre_report_draft: string | null;
  pre_report_metadata: Record<string, unknown> | null;
  classification_result: Record<string, unknown> | null;
  error_message: string | null;
  stub_mode: boolean;
  created_at: string;
  updated_at: string;
}

export function useAiAnalysis(ecgId: string | undefined) {
  const [analysis, setAnalysis] = useState<AiAnalysisPublic | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ecgId) return;
    setLoading(true);
    try {
      const data = await api.get<AiAnalysisPublic | null>(`/ecg-records/${ecgId}/ai/analysis`);
      setAnalysis(data);
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [ecgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { analysis, loading, refetch: load };
}
