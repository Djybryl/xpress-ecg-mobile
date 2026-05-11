import { Stack } from 'expo-router';

export default function InstitutionStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Mon institution',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mon institution' }} />
      <Stack.Screen name="credit-request" options={{ title: 'Demande de crédits' }} />
      <Stack.Screen name="members" options={{ title: 'Membres' }} />
    </Stack>
  );
}
