import { Platform, Share, Linking, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { copyLocalPdfToDocuments } from '@/lib/saveReportPdf';

/**
 * Ouvre le PDF avec une app externe.
 * - Android : feuille système (expo-sharing + content://) — pas de module natif dédié, compatible Expo Go / dev client sans rebuild.
 * - iOS : Linking vers le fichier, sinon Share.
 */
export async function openPdfWithExternalApp(localFileUri: string): Promise<void> {
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(localFileUri);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(contentUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Ouvrir avec une application',
      });
      return;
    }
    await Linking.openURL(contentUri);
    return;
  }

  const fileUrl = localFileUri.startsWith('file://') ? localFileUri : `file://${localFileUri}`;
  try {
    const can = await Linking.canOpenURL(fileUrl);
    if (can) {
      await Linking.openURL(fileUrl);
      return;
    }
  } catch {
    /* fallback ci-dessous */
  }

  await Share.share({
    url: fileUrl,
    title: 'Rapport ECG',
  });
}

/**
 * Feuille de partage système (mail, Drive, Messages, etc.).
 */
export async function sharePdfFile(localFileUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    if (Platform.OS === 'ios') {
      const fileUrl = localFileUri.startsWith('file://') ? localFileUri : `file://${localFileUri}`;
      await Share.share({ url: fileUrl, title: 'Rapport ECG' });
      return;
    }
    throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
  }

  const uriToShare =
    Platform.OS === 'android'
      ? await FileSystem.getContentUriAsync(localFileUri)
      : localFileUri;

  await Sharing.shareAsync(uriToShare, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: 'Partager le rapport',
  });
}

/**
 * Dialogue d’impression système.
 */
export async function printPdfFile(localFileUri: string): Promise<void> {
  await Print.printAsync({ uri: localFileUri });
}

/**
 * Enregistre une copie persistante (Documents/Rapports) ; utile après téléchargement cache.
 */
export async function persistPdfCopy(
  cacheFileUri: string,
  reportId: string,
  patientName: string | null | undefined,
): Promise<{ folderLabel: string }> {
  const { folderLabel } = await copyLocalPdfToDocuments(cacheFileUri, reportId, patientName);
  return { folderLabel };
}

export function alertPdfError(e: unknown, title = 'Impossible d’ouvrir le PDF'): void {
  const msg = e instanceof Error ? e.message : String(e);
  Alert.alert(title, msg);
}
