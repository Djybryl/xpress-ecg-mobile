import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { homeRouteForRole } from '@/lib/routesByRole';

export default function LoginScreen() {
  const { login, loginWithBiometrics, isBiometricAvailable, isBiometricEnrolled } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Champs obligatoires', 'Veuillez saisir votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const session = await login(email.trim().toLowerCase(), password);
      router.replace(homeRouteForRole(session.role));
    } catch (e) {
      Alert.alert('Connexion échouée', e instanceof Error ? e.message : 'Vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setBioLoading(true);
    try {
      const session = await loginWithBiometrics();
      if (session) {
        router.replace(homeRouteForRole(session.role));
      } else {
        Alert.alert('Échec', 'Authentification biométrique échouée.');
      }
    } finally {
      setBioLoading(false);
    }
  };

  const canUseBiometrics = isBiometricAvailable && isBiometricEnrolled;

  const biometricLabel =
    Platform.OS === 'ios' ? 'Se connecter avec Face ID ou Touch ID' : "Se connecter avec l'empreinte digitale";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-indigo-700 dark:bg-indigo-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      accessibilityRole="none"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="scroll"
      >
        {/* Zone branding décorative */}
        <View className="items-center pt-20 pb-10 px-8">
          <View
            className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center mb-4"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Text className="text-white text-3xl font-bold" accessible={false}>
              ♥
            </Text>
          </View>
          {/* Un seul en-tête de page pour VoiceOver */}
          <Text
            className="text-white text-3xl font-bold tracking-tight"
          >
            Xpress ECG
          </Text>
          <Text className="text-indigo-200 text-base mt-1" accessibilityRole="text">
            Espace professionnel
          </Text>
        </View>

        {/* Formulaire */}
        <View
          className="flex-1 bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-8 pb-10"
          accessibilityRole="none"
        >
          <Text
            accessibilityRole="header"
            className="text-gray-800 dark:text-zinc-100 text-2xl font-bold mb-1"
          >
            Connexion
          </Text>
          <Text
            className="text-gray-500 dark:text-zinc-400 text-sm mb-8"
            accessibilityRole="text"
          >
            Connectez-vous pour gérer vos demandes ECG
          </Text>

          {/* Email */}
          <View className="mb-4">
            <Text accessibilityRole="text" className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1.5">
              Adresse email
            </Text>
            <TextInput
              className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              placeholder="dr.dupont@cabinet.fr"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              accessibilityLabel="Adresse email"
              accessibilityHint="Saisissez votre email professionnel"
              editable={!loading}
            />
          </View>

          {/* Mot de passe */}
          <View className="mb-6">
            <Text accessibilityRole="text" className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1.5">
              Mot de passe
            </Text>
            <View className="flex-row border border-gray-200 dark:border-zinc-600 rounded-xl bg-gray-50 dark:bg-zinc-800 overflow-hidden">
              <TextInput
                className="flex-1 px-4 h-12 text-sm text-gray-900 dark:text-zinc-100"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Mot de passe"
                editable={!loading}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                accessibilityState={{ disabled: loading }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="px-4 items-center justify-center"
                onPress={() => setShowPassword((v) => !v)}
                disabled={loading}
              >
                <Text className="text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                  {showPassword ? 'Cacher' : 'Voir'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton connexion */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Connexion en cours, veuillez patienter' : 'Se connecter'}
            accessibilityState={{ disabled: loading, busy: loading }}
            className="bg-indigo-600 rounded-xl h-12 items-center justify-center mb-3"
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="white" accessibilityLabel="Connexion en cours" />
            ) : (
              <Text className="text-white font-semibold text-base">Se connecter</Text>
            )}
          </TouchableOpacity>

          {/* Biométrie */}
          {canUseBiometrics && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={biometricLabel}
              accessibilityState={{ disabled: bioLoading, busy: bioLoading }}
              className="border border-indigo-200 dark:border-violet-700 bg-indigo-50 dark:bg-violet-950/80 rounded-xl h-12 items-center justify-center flex-row gap-2 mb-6"
              onPress={handleBiometric}
              disabled={bioLoading}
              activeOpacity={0.8}
            >
              {bioLoading ? (
                <ActivityIndicator color="#4f46e5" accessibilityLabel="Authentification en cours" />
              ) : (
                <>
                  <Text accessible={false} className="text-lg">
                    {Platform.OS === 'ios' ? '🔒' : '👆'}
                  </Text>
                  <Text className="text-indigo-700 dark:text-violet-200 font-medium text-sm">
                    {Platform.OS === 'ios'
                      ? 'Se connecter avec Face ID ou Touch ID'
                      : 'Se connecter avec l\'empreinte'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text className="text-center text-gray-400 dark:text-zinc-500 text-xs">
            En vous connectant, vous acceptez les conditions d&apos;utilisation de Xpress ECG
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
