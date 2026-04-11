import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';

/** Icône + libellé : tout tient dans la zone sans rognage (pas de marge négative ici). */
function TabIcon({
  name,
  label,
  focused,
  color,
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
    <View
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

/** Bouton central : même logique verticale que les autres onglets. */
function NewEcgIcon({ focused }: { focused: boolean }) {
  const { colors: joyful } = useTheme();
  const size = focused ? 40 : 38;
  const iconSize = focused ? 24 : 22;

  if (focused) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 2 }}>
        <LinearGradient
          colors={[...joyful.gradientFab]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 8,
            shadowColor: '#EC4899',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
          }}
        >
          <Ionicons name="add" size={iconSize} color="white" />
        </LinearGradient>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            fontSize: 9,
            lineHeight: 11,
            marginTop: 3,
            color: joyful.tabFocused,
            fontWeight: '800',
            maxWidth: 72,
            textAlign: 'center',
          }}
        >
          Nouvel ECG
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', paddingTop: 2 }}>
      <LinearGradient
        colors={['#C084FC', '#F472B6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: '#A855F7',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
        }}
      >
        <Ionicons name="add" size={iconSize} color="white" />
      </LinearGradient>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{
          fontSize: 9,
          lineHeight: 11,
          marginTop: 3,
          color: joyful.tabRequests,
          fontWeight: '600',
          maxWidth: 72,
          textAlign: 'center',
        }}
      >
        Nouvel ECG
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { user, loading } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  if (!user) return null;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  /** Hauteur zone icône + libellé (évite tout rognage). */
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
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" label="Accueil" focused={focused} color={joyful.tabHome} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Demandes',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="list" label="Demandes" focused={focused} color={joyful.tabRequests} />
          ),
        }}
      />
      <Tabs.Screen
        name="new-ecg"
        options={{
          title: 'Nouvel ECG',
          tabBarIcon: ({ focused }) => <NewEcgIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Rapports',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="document-text" label="Rapports" focused={focused} color={joyful.tabReports} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" label="Profil" focused={focused} color={joyful.tabProfile} />
          ),
        }}
      />
    </Tabs>
  );
}
