/**
 * Hook pour charger les signaux ECG parsés et l'URL du fichier source.
 * GET /ecg-records/:id/signals   → EcgSignalData[]
 * GET /ecg-files/:fileId/download → { url, filename } (data JSON)
 *
 * Les fichiers image (JPEG/PNG) sont recherchés dans **toute** la liste `files` :
 * si le 1er fichier est un signal numérique (DICOM) et le 2e une photo, l'URL
 * de la photo est quand même résolue (bugfix affichage image cardiologue).
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { EcgSignalData } from '@/lib/ecg-utils';
import type { EcgFileSummary } from '@/hooks/useEcgRecordDetail';

type FileKind = 'image' | 'pdf' | 'signal' | 'parseable_unparsed' | 'none';

interface EcgSignalsResult {
  signals: EcgSignalData[] | null;
  fileKind: FileKind;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const NUMERIC_TYPES = ['DICOM', 'WFDB', 'SCP', 'AECG', 'ISHNE', 'MUSE'];
const NUMERIC_EXTS = ['dcm', 'scp', 'hea', 'dat', 'zip', 'xml', 'ishne', 'ecg'];
const IMAGE_TYPES = ['JPEG', 'PNG', 'WEBP', 'JPG'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

export function classifyFile(file: EcgFileSummary): FileKind {
  const ext = (file.filename ?? '').split('.').pop()?.toLowerCase() ?? '';
  const ft = String(file.file_type ?? '').toLowerCase();
  if (ext === 'pdf' || ft === 'pdf') return 'pdf';
  if (NUMERIC_TYPES.includes(file.file_type ?? '') || NUMERIC_EXTS.includes(ext)) return 'signal';
  if (ft.startsWith('image/')) return 'image';
  if (IMAGE_TYPES.includes(String(file.file_type ?? '').toUpperCase()) || IMAGE_EXTS.includes(ext)) {
    return 'image';
  }
  return 'none';
}

async function fetchSignedFileUrl(fileId: string): Promise<string | null> {
  try {
    const data = await api.get<{ url?: string; filename?: string }>(`/ecg-files/${fileId}/download`);
    const url = data?.url;
    if (typeof url === 'string' && url.length > 0) return url;
  } catch {
    /* fichier inaccessible ou ID invalide */
  }
  return null;
}

export function useEcgSignals(ecgId: string | undefined, files?: EcgFileSummary[]): EcgSignalsResult {
  const [signals, setSignals] = useState<EcgSignalData[] | null>(null);
  const [fileKind, setFileKind] = useState<FileKind>('none');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ecgId) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const file = files?.[0];
      const kind = file ? classifyFile(file) : 'none';

      let hasSignals = false;
      try {
        const raw = await api.get<unknown>(`/ecg-records/${ecgId}/signals`);
        const list = Array.isArray(raw)
          ? raw
          : (raw as { signals?: EcgSignalData[] })?.signals ?? [];
        if (Array.isArray(list) && list.length > 0) {
          setSignals(list as EcgSignalData[]);
          hasSignals = true;
        } else {
          setSignals(null);
        }
      } catch {
        setSignals(null);
      }

      if (hasSignals && (kind === 'signal' || kind === 'none')) {
        setFileKind('signal');
      } else if (hasSignals && kind === 'image') {
        setFileKind('image');
      } else if (!hasSignals && kind === 'signal') {
        setFileKind('parseable_unparsed');
      } else {
        setFileKind(kind);
      }

      let resolvedUrl: string | null = null;

      if (files?.length) {
        const imageCandidates = files.filter(f => classifyFile(f) === 'image');
        for (const f of imageCandidates) {
          const u = await fetchSignedFileUrl(f.id);
          if (u) {
            resolvedUrl = u;
            break;
          }
          if (f.file_url?.startsWith('http')) {
            resolvedUrl = f.file_url;
            break;
          }
        }

        if (!resolvedUrl) {
          const k0 = classifyFile(files[0]);
          if (k0 !== 'signal') {
            const u = await fetchSignedFileUrl(files[0].id);
            if (u) resolvedUrl = u;
            else if (files[0].file_url?.startsWith('http')) resolvedUrl = files[0].file_url;
          }
        }
      }

      setImageUrl(resolvedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement signaux');
    } finally {
      setLoading(false);
    }
  }, [ecgId, files]);

  useEffect(() => {
    void load();
  }, [load]);

  return { signals, fileKind, imageUrl, loading, error, refetch: load };
}
