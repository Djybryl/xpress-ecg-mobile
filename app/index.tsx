import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/providers/AuthProvider';
import {
  View, ActivityIndicator, Text, StyleSheet,
} from 'react-native';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
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

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.hint}>Chargement…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color="#fff" size="large" />
      <Text style={styles.hint}>Ouverture…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  hint: {
    color: '#e0e7ff',
    fontSize: 16,
    marginTop: 8,
  },
});
