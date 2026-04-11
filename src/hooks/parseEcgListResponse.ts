import type { EcgRecordItem } from '@/hooks/useEcgList';

export function parseEcgListResponse(res: unknown): { records: EcgRecordItem[]; total: number } {
  if (Array.isArray(res)) {
    const records = res as EcgRecordItem[];
    return { records, total: records.length };
  }
  const o = res as { records?: EcgRecordItem[]; total?: number };
  const records = o.records ?? [];
  return { records, total: o.total ?? records.length };
}
