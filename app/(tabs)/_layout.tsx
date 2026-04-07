import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View className="items-center justify-center pt-1">
      <Text className="text-lg">{emoji}</Text>
      <Text
        className={`text-[10px] mt-0.5 ${focused ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function NewEcgIcon({ focused }: { focused: boolean }) {
  return (
    <View
      className="w-12 h-12 rounded-2xl items-center justify-center -mt-4 shadow-lg"
      style={{ backgroundColor: focused ? '#4338ca' : '#4f46e5', elevation: 8 }}
    >
      <Text className="text-white text-2xl font-thin leading-none">+</Text>
    </View>
  );
}

export default function TabLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 4,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon emoji="🏠" label="Accueil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Demandes',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon emoji="📋" label="Demandes" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="new-ecg"
        options={{
          title: 'Nouvel ECG',
          tabBarIcon: ({ focused }: { focused: boolean }) => <NewEcgIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Rapports',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon emoji="📄" label="Rapports" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon emoji="👤" label="Profil" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
