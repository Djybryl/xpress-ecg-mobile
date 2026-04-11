import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { usePushNotifications } from '@/hooks/usePushNotifications';

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
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <PushInit />
            <StatusBar style="light" />
            {/* Ne pas lister manuellement les ecrans : sinon `app/index.tsx` peut ne jamais etre monte (ecran fige / splash). */}
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
