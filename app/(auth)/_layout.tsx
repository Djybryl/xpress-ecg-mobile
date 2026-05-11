import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', title: 'Authentification' }}>
      <Stack.Screen name="login" options={{ title: 'Connexion' }} />
      <Stack.Screen
        name="register"
        options={{
          title: 'Créer un compte',
          headerShown: true,
          headerStyle: { backgroundColor: '#4f46e5' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </Stack>
  );
}
