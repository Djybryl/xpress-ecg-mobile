import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistDashboard } from '@/hooks/useCardiologistDashboard';
import { useMyAssignedEcg } from '@/hooks/useMyAssignedEcg';

function TabIcon({
  name,
  label,
  focused,
  color,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  color: string;
  badge?: number;
}) {
  const { colors: joyful } = useTheme();
  const iconColor = focused ? joyful.tabFocused : color;
  const labelColor = focused ? joyful.tabFocused : color;

  return (
    <View
      accessible={false}
      style={{
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 4,
        paddingHorizontal: 2,
        minWidth: 56,
        maxWidth: 76,
      }}
    >
      <View
        style={{
          width: 36,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          backgroundColor: focused ? joyful.primaryMuted : 'transparent',
        }}
      >
        <Ionicons name={name} size={20} color={iconColor} />
        {badge != null && badge > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              backgroundColor: '#ef4444',
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{
          fontSize: 9,
          lineHeight: 11,
          marginTop: 3,
          color: labelColor,
          fontWeight: focused ? '800' : '600',
          textAlign: 'center',
          width: '100%',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function CardiologueTabLayout() {
  const ok = useRoleGuard('cardiologue');
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const { stats } = useCardiologistDashboard(!!user?.id);
  const { pendingCount: myEcgBadge } = useMyAssignedEcg(user?.id);

  const queueBadge = (stats?.assigned_count ?? 0) + (stats?.analyzing_count ?? 0);

  if (!ok) return null;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  const tabBarContentHeight = 60;
  const tabBarHeight = tabBarContentHeight + bottomInset + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
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
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
          minHeight: tabBarContentHeight,
          justifyContent: 'flex-start',
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarAccessibilityLabel: 'Accueil cardiologue',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="pulse" label="Accueil" focused={focused} color={joyful.tabHome} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'File ECG',
          tabBarAccessibilityLabel:
            queueBadge > 0 ? `File ECG, ${queueBadge} éléments en cours` : 'File ECG',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="layers" label="File ECG" focused={focused} color={joyful.tabRequests} badge={queueBadge} />
          ),
        }}
      />
      <Tabs.Screen
        name="mes-ecg"
        options={{
          title: 'Mes ECG',
          tabBarAccessibilityLabel:
            myEcgBadge > 0
              ? `Mes ECG, ${myEcgBadge} à prendre en charge`
              : 'Mes ECG',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="person-circle"
              label="Mes ECG"
              focused={focused}
              color={joyful.tabRequests}
              badge={myEcgBadge}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Mon profil',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" label="Profil" focused={focused} color={joyful.tabProfile} />
          ),
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          title: 'Plus',
          tabBarAccessibilityLabel: 'Plus de fonctionnalités',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="ellipsis-horizontal"
              label="Plus"
              focused={focused}
              color={joyful.tabProfile}
            />
          ),
        }}
      />
      <Tabs.Screen name="commissions" options={{ href: null, title: 'Ratios' }} />
      <Tabs.Screen name="history" options={{ href: null, title: 'Historique' }} />
      <Tabs.Screen name="second-opinions" options={{ href: null, title: 'Second avis' }} />
      <Tabs.Screen name="commissions-financieres" options={{ href: null, title: 'Commissions' }} />
      <Tabs.Screen name="interpret/[id]" options={{ href: null, title: 'Interprétation' }} />
      <Tabs.Screen name="second-opinion/[id]" options={{ href: null, title: 'Second avis' }} />
      <Tabs.Screen name="request-second-opinion" options={{ href: null, title: 'Demander un second avis' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
    </Tabs>
  );
}
