import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', title: 'Authentification' }}>
      <Stack.Screen name="login" options={{ title: 'Connexion' }} />
    </Stack>
  );
}
