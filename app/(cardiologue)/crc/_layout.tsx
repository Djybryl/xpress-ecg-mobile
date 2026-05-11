import { Stack } from 'expo-router';

export default function CardiologueCrcLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Réseau CRC' }} />
      <Stack.Screen name="register" options={{ title: 'Activer le CRC' }} />
      <Stack.Screen name="queue" options={{ title: 'File ECG réseau' }} />
      <Stack.Screen name="prescripteurs" options={{ title: 'Prescripteurs' }} />
      <Stack.Screen name="recharge" options={{ title: 'Recharger le CRC' }} />
    </Stack>
  );
}
