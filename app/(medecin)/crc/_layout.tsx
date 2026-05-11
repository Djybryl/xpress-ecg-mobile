import { Stack } from 'expo-router';

export default function CrcNetworksLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Mes réseaux CRC',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mes réseaux CRC' }} />
    </Stack>
  );
}
