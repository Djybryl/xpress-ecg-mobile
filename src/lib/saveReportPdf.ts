import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const REPORTS_SUBDIR = 'Rapports';

function sanitizeFilePart(s: string, maxLen: number): string {
  const base = (s || 'Patient')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (base || 'Patient').slice(0, maxLen);
}

function buildPdfFileName(reportId: string, patientName: string | null | undefined): string {
  const slug = sanitizeFilePart(patientName ?? 'Patient', 36);
  const idShort = reportId.replace(/-/g, '').slice(0, 12);
  return `ECG_${slug}_${idShort}.pdf`;
}

/**
 * Télécharge le PDF (URL signée) dans le cache applicatif — pour aperçu, partage, impression.
 */
export async function downloadReportPdfToCache(
  signedUrl: string,
  reportId: string,
  patientName: string | null | undefined,
): Promise<string> {
  const cache = FileSystem.cacheDirectory;
  if (!cache) {
    throw new Error('Espace cache indisponible sur cet appareil.');
  }
  const fileName = buildPdfFileName(reportId, patientName);
  const destUri = `${cache}${fileName}`;
  await FileSystem.deleteAsync(destUri, { idempotent: true });
  const { status } = await FileSystem.downloadAsync(signedUrl, destUri);
  if (status !== 200) {
    throw new Error(`Échec du téléchargement du PDF (code ${status}).`);
  }
  return destUri;
}

function persistentFolderLabel(): string {
  return Platform.OS === 'ios'
    ? 'Fichiers > Sur mon iPhone > Xpress ECG > Rapports'
    : 'Stockage de l’app Xpress ECG (dossier Rapports), accessible via l’app Fichiers sur certains appareils';
}

/**
 * Copie un PDF local (ex. depuis le cache) vers Documents/Rapports.
 */
export async function copyLocalPdfToDocuments(
  sourceUri: string,
  reportId: string,
  patientName: string | null | undefined,
): Promise<{ localUri: string; folderLabel: string }> {
  const root = FileSystem.documentDirectory;
  if (!root) {
    throw new Error('Stockage local indisponible sur cet appareil.');
  }

  const dir = `${root}${REPORTS_SUBDIR}/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const fileName = buildPdfFileName(reportId, patientName);
  const destUri = `${dir}${fileName}`;

  const existing = await FileSystem.getInfoAsync(destUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  return { localUri: destUri, folderLabel: persistentFolderLabel() };
}

/**
 * Télécharge et enregistre directement dans Documents/Rapports (sans feuille de choix).
 */
export async function saveReportPdfFromSignedUrl(
  signedUrl: string,
  reportId: string,
  patientName: string | null | undefined,
): Promise<{ localUri: string; folderLabel: string }> {
  const cacheUri = await downloadReportPdfToCache(signedUrl, reportId, patientName);
  return copyLocalPdfToDocuments(cacheUri, reportId, patientName);
}
