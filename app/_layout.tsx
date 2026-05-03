import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { I18nProvider } from '@/i18n';

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
