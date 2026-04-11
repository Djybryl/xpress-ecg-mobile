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

/**
 * Télécharge le PDF depuis l’URL signée et l’enregistre dans le stockage persistant
 * de l’application (dossier Documents/Rapports). Aucune feuille de partage ni navigateur.
 */
export async function saveReportPdfFromSignedUrl(
  signedUrl: string,
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

  const slug = sanitizeFilePart(patientName ?? 'Patient', 36);
  const idShort = reportId.replace(/-/g, '').slice(0, 12);
  const fileName = `ECG_${slug}_${idShort}.pdf`;
  const destUri = `${dir}${fileName}`;

  const existing = await FileSystem.getInfoAsync(destUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  }

  const { status } = await FileSystem.downloadAsync(signedUrl, destUri);
  if (status !== 200) {
    throw new Error(`Échec du téléchargement du PDF (code ${status}).`);
  }

  const folderLabel =
    Platform.OS === 'ios'
      ? 'Fichiers > Sur mon iPhone > Xpress ECG > Rapports'
      : 'Fichiers / stockage de l’app (dossier Rapports)';

  return { localUri: destUri, folderLabel };
}
