import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

/**
 * Gère la permission d'accès à la photothèque (galerie).
 * Conforme à la politique A1 : permission demandée seulement au moment de l'action,
 * avec message FR défini dans app.json.
 */
export function useImagePickerPermission() {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');

  const request = useCallback(async (): Promise<boolean> => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const granted = result.status === ImagePicker.PermissionStatus.GRANTED;
    setStatus(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const check = useCallback(async (): Promise<PermissionStatus> => {
    const result = await ImagePicker.getMediaLibraryPermissionsAsync();
    const s: PermissionStatus =
      result.status === ImagePicker.PermissionStatus.GRANTED
        ? 'granted'
        : result.status === ImagePicker.PermissionStatus.DENIED
        ? 'denied'
        : 'undetermined';
    setStatus(s);
    return s;
  }, []);

  return { status, request, check };
}
