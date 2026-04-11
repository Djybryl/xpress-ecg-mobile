import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useImagePickerPermission } from './useImagePickerPermission';

// ─── Politique fichier (Phase A1) ──────────────────────────────────────────
// Format : JPEG, grande dimension ≤ 3 000 px, qualité JPEG 0.85.
// L'orientation EXIF est corrigée ici pour la galerie ; le scanner gère la sienne.
const MAX_DIMENSION = 3000;
const JPEG_QUALITY = 0.85;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ECGImageResult {
  /** URI locale vers le fichier corrigé (JPEG). */
  uri: string;
  /** Largeur en pixels après correction. */
  width: number;
  /** Hauteur en pixels après correction. */
  height: number;
  /** Taille estimée en octets (si fournie par le picker). */
  fileSize?: number;
}

export type CorrectionError =
  | 'permission_denied'
  | 'cancelled'
  | 'processing_failed';

export interface UseECGImageCorrectionResult {
  /** Image corrigée, disponible après un appel à `pickAndCorrect`. */
  image: ECGImageResult | null;
  /** Traitement en cours. */
  processing: boolean;
  /** Dernière erreur (null si aucune). */
  error: CorrectionError | null;
  /** Ouvrir la galerie, choisir une image, la corriger et stocker le résultat. */
  pickAndCorrect: () => Promise<ECGImageResult | null>;
  /** Réinitialiser l'état (image, erreur). */
  reset: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Phase A2 — sélection galerie + correction image ECG.
 *
 * Enchaîne :
 *  1. Demande de permission photothèque (si pas encore accordée).
 *  2. Ouverture du picker galerie (JPEG / PNG uniquement).
 *  3. Correction EXIF (rotation) via expo-image-manipulator.
 *  4. Redimensionnement si une dimension dépasse MAX_DIMENSION.
 *  5. Export en JPEG qualité JPEG_QUALITY.
 */
export function useECGImageCorrection(): UseECGImageCorrectionResult {
  const [image, setImage] = useState<ECGImageResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<CorrectionError | null>(null);

  const { request: requestPermission } = useImagePickerPermission();

  const pickAndCorrect = useCallback(async (): Promise<ECGImageResult | null> => {
    setError(null);
    setProcessing(true);

    try {
      // 1. Permission photothèque
      const granted = await requestPermission();
      if (!granted) {
        setError('permission_denied');
        return null;
      }

      // 2. Picker galerie (images uniquement)
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,          // on gère la compression nous-mêmes
        exif: true,          // nécessaire pour la détection d'orientation
      });

      if (pickerResult.canceled || pickerResult.assets.length === 0) {
        setError('cancelled');
        return null;
      }

      const asset = pickerResult.assets[0];

      // 3 + 4. Construire la liste des transformations
      const actions: ImageManipulator.Action[] = [];

      // Correction d'orientation EXIF
      const orientation: number = (asset.exif as Record<string, unknown> | null | undefined)
        ?.Orientation as number ?? 1;
      const rotationDeg = exifOrientationToDeg(orientation);
      if (rotationDeg !== 0) {
        actions.push({ rotate: rotationDeg });
      }

      // Redimensionnement si nécessaire (après rotation éventuelle)
      const w = asset.width ?? 0;
      const h = asset.height ?? 0;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
        actions.push({
          resize: {
            width: Math.round(w * ratio),
            height: Math.round(h * ratio),
          },
        });
      }

      // 5. Traitement avec expo-image-manipulator
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        actions,
        {
          compress: JPEG_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const result: ECGImageResult = {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
        fileSize: asset.fileSize,
      };

      setImage(result);
      return result;

    } catch {
      setError('processing_failed');
      return null;
    } finally {
      setProcessing(false);
    }
  }, [requestPermission]);

  const reset = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return { image, processing, error, pickAndCorrect, reset };
}

// ─── Utilitaire EXIF ───────────────────────────────────────────────────────

/**
 * Convertit la valeur EXIF Orientation (1-8) en degrés de rotation à appliquer
 * pour remettre l'image à l'endroit.
 * Les cas miroir (2, 4, 5, 7) sont traités comme la rotation pure la plus proche
 * car expo-image-manipulator ne gère pas le flip natif ; les images ECG scannées
 * depuis une galerie standard ne devraient pas avoir de flip.
 */
function exifOrientationToDeg(orientation: number): number {
  switch (orientation) {
    case 3: return 180;
    case 6: return 90;
    case 8: return -90;
    // 1 = normal, 2/4/5/7 = miroir (ignoré)
    default: return 0;
  }
}
