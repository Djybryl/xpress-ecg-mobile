import { Stack } from 'expo-router';

export default function InstitutionEcgLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'ECG institutionnels' }} />
    </Stack>
  );
}
