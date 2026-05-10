import '../global.css';
import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { I18nProvider } from '@/i18n';

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View style={{
      backgroundColor: '#ef4444',
      paddingVertical: 6,
      paddingHorizontal: 16,
      alignItems: 'center',
    }}>
      <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
        ⚠️ Pas de connexion réseau
      </Text>
    </View>
  );
}

/** Composant interne qui accède au contexte auth pour initialiser les push. */
function PushInit() {
  const { user } = useAuth();
  usePushNotifications({
    userId: user?.id ?? null,
    role: user?.role ?? null,
    enabled: !!user,
  });
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <OfflineBanner />
              <PushInit />
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 220,
                  // A11y : titre annoncé par VoiceOver / TalkBack même sans en-tête visible
                  title: 'Xpress-ECG',
                }}
              />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
