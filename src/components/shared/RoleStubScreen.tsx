import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';

type Props = { title: string; description: string };

/** Écran minimal pour un rôle en cours d’implémentation (phases 2–4). */
export function RoleStubScreen({ title, description }: Props) {
  const { colors, isDark } = useTheme();
  const { logout } = useAuth();
  const sub = isDark ? '#a1a1aa' : '#52525b';

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary }}>{title}</Text>
      <Text style={{ marginTop: 14, fontSize: 15, lineHeight: 22, color: sub }}>{description}</Text>
      <TouchableOpacity
        onPress={() => void logout()}
        style={{
          marginTop: 32,
          alignSelf: 'flex-start',
          paddingVertical: 12,
          paddingHorizontal: 20,
          backgroundColor: colors.primaryMuted,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: colors.primaryDark, fontWeight: '600' }}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}
