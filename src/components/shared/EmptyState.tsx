import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Écran vide réutilisable — toutes les listes / files vides de l'application.
 */
export function EmptyState({
  icon = 'document-text-outline',
  title = 'Aucun élément',
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors: joyful } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
      <View
        style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: joyful.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
      >
        <Ionicons name={icon} size={34} color={joyful.primary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151', textAlign: 'center', marginBottom: 6 }}>
        {title}
      </Text>
      {description != null && description !== '' && (
        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 }}>
          {description}
        </Text>
      )}
      {actionLabel != null && onAction != null && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.85}
          style={{ marginTop: 20, backgroundColor: joyful.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
