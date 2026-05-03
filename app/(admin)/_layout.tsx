import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useRoleGuard } from '@/hooks/useRoleGuard';

function TabIcon({
  name, label, focused, color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  color: string;
}) {
  const { colors: joyful } = useTheme();
  const iconColor = focused ? joyful.tabFocused : color;
  const labelColor = focused ? joyful.tabFocused : color;
  return (
    <View accessible={false} style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, paddingHorizontal: 2, minWidth: 56, maxWidth: 76 }}>
      <View style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: focused ? joyful.primaryMuted : 'transparent' }}>
        <Ionicons name={name} size={20} color={iconColor} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 9, lineHeight: 11, marginTop: 3, color: labelColor, fontWeight: focused ? '800' : '600', textAlign: 'center', width: '100%' }}>
        {label}
      </Text>
    </View>
  );
}

export default function AdminTabLayout() {
  const ok = useRoleGuard('admin');
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  if (!ok) return null;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  const tabBarContentHeight = 60;
  const tabBarHeight = tabBarContentHeight + bottomInset + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: joyful.tabBarBg,
          borderTopColor: joyful.tabBarBorder,
          borderTopWidth: 2,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 4,
          overflow: 'visible',
          elevation: 12,
          shadowColor: joyful.primaryLight,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarItemStyle: { paddingTop: 0, paddingBottom: 0, minHeight: tabBarContentHeight, justifyContent: 'flex-start' },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Tableau de bord', tabBarAccessibilityLabel: 'Tableau de bord administrateur', tabBarIcon: ({ focused }) => <TabIcon name="stats-chart" label="Dashboard" focused={focused} color={joyful.tabHome} /> }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: 'Utilisateurs', tabBarAccessibilityLabel: 'Gestion des utilisateurs', tabBarIcon: ({ focused }) => <TabIcon name="people" label="Utilisateurs" focused={focused} color={joyful.tabRequests} /> }}
      />
      <Tabs.Screen
        name="prescribers"
        options={{ title: 'Dossiers', tabBarAccessibilityLabel: 'Dossiers et prescripteurs', tabBarIcon: ({ focused }) => <TabIcon name="document-text" label="Dossiers" focused={focused} color={joyful.tabReports} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Paramètres', tabBarAccessibilityLabel: 'Paramètres de la plateforme', tabBarIcon: ({ focused }) => <TabIcon name="settings" label="Paramètres" focused={focused} color="#64748b" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarAccessibilityLabel: 'Mon profil', tabBarIcon: ({ focused }) => <TabIcon name="person" label="Profil" focused={focused} color={joyful.tabProfile} /> }}
      />
    </Tabs>
  );
}
