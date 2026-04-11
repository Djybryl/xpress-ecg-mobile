import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import {
  View, ActivityIndicator, Text,
} from 'react-native';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const navigated = useRef(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => null);
  }, []);

  useEffect(() => {
    if (loading || navigated.current) return;
    navigated.current = true;
    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [loading, user, router]);

  const wrapStyle = {
    flex: 1,
    backgroundColor: isDark ? '#312e81' : '#4f46e5',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
  };
  const hintStyle = {
    color: isDark ? '#c7d2fe' : '#e0e7ff',
    fontSize: 16,
    marginTop: 8,
  };

  if (loading) {
    return (
      <View style={wrapStyle}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={hintStyle}>Chargement…</Text>
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      <ActivityIndicator color="#fff" size="large" />
      <Text style={hintStyle}>Ouverture…</Text>
    </View>
  );
}
