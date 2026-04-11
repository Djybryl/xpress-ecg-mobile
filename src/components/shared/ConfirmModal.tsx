import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'destructive' affiche le bouton de confirmation en rouge */
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Modale de confirmation réutilisable pour toutes les actions sensibles.
 * Remplace les Alert.alert() pour une UX plus soignée.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
  icon,
}: ConfirmModalProps) {
  const { colors: joyful } = useTheme();

  const confirmBg = variant === 'destructive' ? '#dc2626' : joyful.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 }}
        >
          {/* Icon */}
          {icon != null && (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: variant === 'destructive' ? '#fee2e2' : joyful.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={26} color={variant === 'destructive' ? '#dc2626' : joyful.primary} />
              </View>
            </View>
          )}

          {/* Text */}
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            {message}
          </Text>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              style={{ flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151' }}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              style={{ flex: 1, backgroundColor: confirmBg, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
