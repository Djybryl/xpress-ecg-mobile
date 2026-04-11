/**
 * Composant ECGImageCapture — acquisition d'images ECG.
 * Thème « joyeux » : carte colorée, bouton caméra très visible, galerie + PDF sur une ligne.
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { useECGImageCorrection, type ECGImageResult } from '@/hooks/useECGImageCorrection';
import { useTheme } from '@/providers/ThemeProvider';

const MAX_DIMENSION = 3000;
const JPEG_QUALITY = 0.85;
const MAX_PAGES = 3;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types publics ─────────────────────────────────────────────────────────

export interface ECGCaptureResult extends ECGImageResult {
  source: 'scanner' | 'gallery';
  fileName: string;
  quality?: 'good' | 'fair' | 'poor';
}

export interface ECGCaptureMultiResult {
  pages: ECGCaptureResult[];
}

interface ECGImageCaptureProps {
  onCapture: (result: ECGCaptureMultiResult) => void;
  onClear?: () => void;
  value?: ECGCaptureMultiResult | null;
  /** Bouton PDF/DICOM à droite de « Galerie » (même ligne). Masquer si `null`. */
  documentSlot?: React.ReactNode;
}

// ─── ScaleButton ───────────────────────────────────────────────────────────

function ScaleButton({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={0.92}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Guide visuel ──────────────────────────────────────────────────────────

function CaptureGuide({ onDismiss }: { onDismiss: () => void }) {
  const { colors: joyful } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.guide,
        {
          opacity,
          backgroundColor: joyful.guideBg,
          borderColor: joyful.guideBorder,
        },
      ]}
    >
      <View style={styles.guideIconRow}>
        <View style={styles.guideStep}>
          <View style={[styles.guideCircle, { borderColor: joyful.guideBorder, backgroundColor: joyful.neutral.surface }]}>
            <Ionicons name="sunny-outline" size={24} color={joyful.guideAccent} />
          </View>
          <Text style={[styles.guideStepText, { color: joyful.primaryDark }]}>Bon éclairage{'\n'}sans reflet</Text>
        </View>
        <View style={styles.guideStep}>
          <View style={[styles.guideCircle, { borderColor: joyful.guideBorder, backgroundColor: joyful.neutral.surface }]}>
            <Ionicons name="tablet-landscape-outline" size={24} color={joyful.guideAccent} />
          </View>
          <Text style={[styles.guideStepText, { color: joyful.primaryDark }]}>Tracé à plat{'\n'}bien cadré</Text>
        </View>
        <View style={styles.guideStep}>
          <View style={[styles.guideCircle, { borderColor: joyful.guideBorder, backgroundColor: joyful.neutral.surface }]}>
            <Ionicons name="scan-outline" size={24} color={joyful.guideAccent} />
          </View>
          <Text style={[styles.guideStepText, { color: joyful.primaryDark }]}>Cadrage auto{'\n'}par le scanner</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.guideDismiss, { backgroundColor: joyful.primary }]} onPress={onDismiss}>
        <Text style={styles.guideDismissText}>Compris</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Qualité ─────────────────────────────────────────────────────────────

async function assessImageQuality(uri: string): Promise<'good' | 'fair' | 'poor'> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return 'poor';
    const sizeKb = (info.size ?? 0) / 1024;
    if (sizeKb < 30) return 'poor';
    if (sizeKb < 100) return 'fair';
    return 'good';
  } catch {
    return 'fair';
  }
}

function QualityBadge({ quality }: { quality: 'good' | 'fair' | 'poor' }) {
  const cfg = {
    good: { icon: 'checkmark-circle' as const, color: '#16a34a', bg: '#dcfce7', label: 'Bonne qualité' },
    fair: { icon: 'alert-circle' as const, color: '#d97706', bg: '#fef3c7', label: 'Qualité moyenne' },
    poor: { icon: 'close-circle' as const, color: '#dc2626', bg: '#fee2e2', label: 'Qualité faible — reprendre ?' },
  }[quality];

  return (
    <View style={[styles.qualityBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
      <Text style={[styles.qualityText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Zoom ────────────────────────────────────────────────────────────────

function ImageZoomViewer({
  uri,
  visible,
  onClose,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.zoomOverlay}>
        <Pressable style={styles.zoomClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="white" />
        </Pressable>
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          contentContainerStyle={styles.zoomContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bouncesZoom
        >
          <Image
            source={{ uri }}
            style={{ width: SCREEN_W, height: SCREEN_H * 0.8 }}
            resizeMode="contain"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────

export default function ECGImageCapture({
  onCapture,
  onClear,
  value,
  documentSlot,
}: ECGImageCaptureProps) {
  const { colors: joyful } = useTheme();
  const [loadingSource, setLoadingSource] = useState<'scanner' | 'gallery' | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const { pickAndCorrect } = useECGImageCorrection();

  const pages = value?.pages ?? [];
  const canAddMore = pages.length < MAX_PAGES;
  const isLoading = loadingSource !== null;

  const emitCapture = useCallback((newPages: ECGCaptureResult[]) => {
    onCapture({ pages: newPages });
  }, [onCapture]);

  const handleScanner = useCallback(async () => {
    setLoadingSource('scanner');
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        responseType: DocumentScanner.ResponseType?.ImageFilePath ?? 'imageFilePath',
      });
      if (status === 'cancel' || !scannedImages?.length) return;

      const rawUri = scannedImages[0];
      const manip = await ImageManipulator.manipulateAsync(
        rawUri,
        [{ resize: { width: MAX_DIMENSION } }],
        { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
      );

      const quality = await assessImageQuality(manip.uri);

      await Haptics.notificationAsync(
        quality === 'poor'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );

      const page: ECGCaptureResult = {
        uri: manip.uri,
        width: manip.width,
        height: manip.height,
        source: 'scanner',
        fileName: `ecg_scan_${Date.now()}.jpg`,
        quality,
      };
      emitCapture([...pages, page]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('cancel')) {
        Alert.alert('Scanner', 'Le scanner n\'a pas pu démarrer. Vérifiez les permissions caméra.');
      }
    } finally {
      setLoadingSource(null);
    }
  }, [pages, emitCapture]);

  const handleGallery = useCallback(async () => {
    setLoadingSource('gallery');
    try {
      const result = await pickAndCorrect();
      if (!result) return;

      const quality = await assessImageQuality(result.uri);

      await Haptics.notificationAsync(
        quality === 'poor'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );

      const page: ECGCaptureResult = {
        ...result,
        source: 'gallery',
        fileName: `ecg_gal_${Date.now()}.jpg`,
        quality,
      };
      emitCapture([...pages, page]);
    } finally {
      setLoadingSource(null);
    }
  }, [pickAndCorrect, pages, emitCapture]);

  const removePage = useCallback((index: number) => {
    const next = pages.filter((_, i) => i !== index);
    if (next.length === 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        onClear?.();
        fadeAnim.setValue(1);
      });
    } else {
      emitCapture(next);
    }
  }, [pages, emitCapture, onClear, fadeAnim]);

  // ── Pages capturées ─────────────────────────────────────────────────────

  if (pages.length > 0) {
    return (
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        {pages.map((page, idx) => (
          <View
            key={page.fileName}
            style={[
              styles.pageCard,
              {
                borderColor: joyful.captureCardBorder,
                backgroundColor: joyful.neutral.surface,
              },
            ]}
          >
            <Pressable onPress={() => setZoomUri(page.uri)}>
              <Image
                source={{ uri: page.uri }}
                style={[styles.pageImage, { backgroundColor: joyful.captureCardBg }]}
                resizeMode="contain"
              />
              <View style={styles.zoomHint}>
                <Ionicons name="expand-outline" size={16} color="white" />
              </View>
            </Pressable>
            <View style={[styles.pageFooter, { borderTopColor: joyful.captureCardBorder }]}>
              <View style={styles.pageInfo}>
                <View style={styles.pageLabel}>
                  <Ionicons
                    name={page.source === 'scanner' ? 'scan' : 'images'}
                    size={14}
                    color={joyful.primary}
                  />
                  <Text style={[styles.pageLabelText, { color: joyful.primaryDark }]}>
                    Page {idx + 1} — {page.width}×{page.height}
                  </Text>
                </View>
                {page.quality && <QualityBadge quality={page.quality} />}
              </View>
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: joyful.galleryBg }]}
                onPress={() => removePage(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={joyful.galleryIcon} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {canAddMore && (
          <View style={styles.addRow}>
            <ScaleButton onPress={handleScanner} disabled={isLoading} style={[styles.addBtnScan, { borderColor: joyful.primaryLight, backgroundColor: joyful.primaryMuted }]}>
              {loadingSource === 'scanner'
                ? <ActivityIndicator size="small" color={joyful.primary} />
                : (
                  <>
                    <Ionicons name="camera" size={20} color={joyful.primary} />
                    <Text style={[styles.addBtnText, { color: joyful.primaryDark }]}>Scanner</Text>
                  </>
                )
              }
            </ScaleButton>
            <ScaleButton onPress={handleGallery} disabled={isLoading} style={[styles.addBtnGal, { borderColor: joyful.galleryBorder, backgroundColor: joyful.galleryBg }]}>
              {loadingSource === 'gallery'
                ? <ActivityIndicator size="small" color={joyful.galleryIcon} />
                : (
                  <>
                    <Ionicons name="images" size={20} color={joyful.galleryIcon} />
                    <Text style={[styles.addBtnText, { color: joyful.galleryText }]}>Galerie</Text>
                  </>
                )
              }
            </ScaleButton>
          </View>
        )}

        <Text style={[styles.pageCounter, { color: joyful.primaryLight }]}>
          {pages.length}/{MAX_PAGES} page{pages.length > 1 ? 's' : ''}
        </Text>

        {zoomUri && (
          <ImageZoomViewer uri={zoomUri} visible onClose={() => setZoomUri(null)} />
        )}
      </Animated.View>
    );
  }

  // ── État initial : carte colorée ────────────────────────────────────────

  return (
    <View
      style={[
        styles.captureCard,
        {
          backgroundColor: joyful.captureCardBg,
          borderColor: joyful.captureCardBorder,
          shadowColor: joyful.captureCardShadow,
        },
      ]}
    >
      {showGuide && <CaptureGuide onDismiss={() => setShowGuide(false)} />}

      <ScaleButton onPress={handleScanner} disabled={isLoading} style={{ width: '100%', opacity: isLoading ? 0.85 : 1 }}>
        <LinearGradient
          colors={[...joyful.gradientCamera]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btnCameraGradient, isLoading && styles.btnDisabled]}
        >
          {loadingSource === 'scanner'
            ? <ActivityIndicator color="white" size="large" />
            : (
              <>
                <View style={styles.cameraRingOuter}>
                  <View style={styles.cameraRingInner}>
                    <Ionicons name="camera" size={36} color={joyful.primaryDark} />
                  </View>
                </View>
                <View style={styles.cameraTextBlock}>
                  <Text style={styles.btnCameraTitle}>Ouvrir la caméra</Text>
                  <Text style={styles.btnCameraSubtitle}>Scanner le tracé ECG — recadrage auto</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
              </>
            )
          }
        </LinearGradient>
      </ScaleButton>

      <View style={styles.secondaryRow}>
        <ScaleButton
          onPress={handleGallery}
          disabled={isLoading}
          style={[
            styles.btnPastelGallery,
            { borderColor: joyful.galleryBorder, backgroundColor: joyful.galleryBg },
            !documentSlot && { flex: 1 },
            documentSlot && { flex: 1 },
            isLoading && styles.btnDisabled,
          ]}
        >
          {loadingSource === 'gallery'
            ? <ActivityIndicator color={joyful.galleryIcon} size="small" />
            : (
              <>
                <Ionicons name="images" size={24} color={joyful.galleryIcon} />
                <Text style={[styles.pastelBtnTitle, { color: joyful.galleryText }]}>Galerie</Text>
                <Text style={[styles.pastelBtnSub, { color: joyful.galleryIcon }]}>Photos existantes</Text>
              </>
            )
          }
        </ScaleButton>

        {documentSlot ? (
          <View style={{ flex: 1, minWidth: 0 }}>{documentSlot}</View>
        ) : null}
      </View>

      <View style={[styles.tip, { backgroundColor: joyful.tipBg, borderColor: joyful.tipBorder }]}>
        <Ionicons name="sparkles" size={18} color={joyful.tipIcon} style={{ marginRight: 10 }} />
        <Text style={[styles.tipText, { color: joyful.tipText }]}>
          Astuce : placez le papier à plat, sous une lumière douce, sans reflet sur le tracé.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 12 },

  captureCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    gap: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },

  guide: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 2,
  },
  guideIconRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  guideStep: { alignItems: 'center', flex: 1 },
  guideCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
  },
  guideStepText: { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 14 },
  guideDismiss: { alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20 },
  guideDismissText: { color: 'white', fontSize: 13, fontWeight: '700' },

  btnCameraGradient: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cameraRingOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraRingInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  cameraTextBlock: { flex: 1 },
  btnCameraTitle: { color: 'white', fontWeight: '800', fontSize: 17, letterSpacing: 0.2 },
  btnCameraSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 4, fontWeight: '500' },

  secondaryRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  btnPastelGallery: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 88,
  },
  pastelBtnTitle: { fontSize: 14, fontWeight: '700' },
  pastelBtnSub: { fontSize: 10, fontWeight: '600', opacity: 0.85 },

  tip: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipText: { fontSize: 12, flex: 1, fontWeight: '600', lineHeight: 18 },

  btnDisabled: { opacity: 0.55 },

  pageCard: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  pageImage: { width: '100%', height: 180 },
  zoomHint: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 4,
  },
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  pageInfo: { flex: 1, gap: 4 },
  pageLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageLabelText: { fontSize: 12, fontWeight: '700' },
  removeBtn: { borderRadius: 10, padding: 8 },

  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qualityText: { fontSize: 11, fontWeight: '600' },

  addRow: { flexDirection: 'row', gap: 10 },
  addBtnScan: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
  },
  addBtnGal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
  },
  addBtnText: { fontSize: 13, fontWeight: '700' },

  pageCounter: { textAlign: 'center', fontSize: 12, fontWeight: '600' },

  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 8,
  },
  zoomContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
