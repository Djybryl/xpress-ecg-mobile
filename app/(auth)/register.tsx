import { useReducer, useCallback } from 'react';
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
import NetInfo from '@react-native-community/netinfo';
import { api, getApiErrorMessage } from '@/lib/apiClient';

type RegisterRole = 'medecin' | 'cardiologue';

type RegisterState = {
  role: RegisterRole;
  fullName: string;
  email: string;
  password: string;
  specialty: string;
  cnom: string;
  pseudo: string;
  loading: boolean;
  error: string | null;
  fieldErrors: { pseudo?: string };
  success: boolean;
};

const initialState: RegisterState = {
  role: 'medecin',
  fullName: '',
  email: '',
  password: '',
  specialty: '',
  cnom: '',
  pseudo: '',
  loading: false,
  error: null,
  fieldErrors: {},
  success: false,
};

type RegisterAction =
  | { type: 'set_role'; role: RegisterRole }
  | { type: 'set_field'; field: keyof Pick<RegisterState, 'fullName' | 'email' | 'password' | 'specialty' | 'cnom' | 'pseudo'>; value: string }
  | { type: 'submit_start' }
  | { type: 'submit_error'; message: string }
  | { type: 'field_error'; field: 'pseudo'; message: string | undefined }
  | { type: 'submit_success' };

function registerReducer(state: RegisterState, action: RegisterAction): RegisterState {
  switch (action.type) {
    case 'set_role':
      return {
        ...state,
        role: action.role,
        fieldErrors: action.role === 'medecin' ? {} : state.fieldErrors,
      };
    case 'set_field':
      return {
        ...state,
        [action.field]: action.value,
        fieldErrors: action.field === 'pseudo' ? { ...state.fieldErrors, pseudo: undefined } : state.fieldErrors,
        error: null,
      };
    case 'submit_start':
      return { ...state, loading: true, error: null, fieldErrors: {} };
    case 'submit_error':
      return { ...state, loading: false, error: action.message };
    case 'field_error':
      return {
        ...state,
        loading: false,
        fieldErrors: { ...state.fieldErrors, pseudo: action.message },
      };
    case 'submit_success':
      return { ...state, loading: false, success: true, error: null };
    default:
      return state;
  }
}

function passwordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 6) return 'weak';
  const hasNum = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  if (password.length >= 12 && hasNum && hasLetter && hasSpecial) return 'strong';
  if (password.length >= 8 && hasNum && hasLetter) return 'medium';
  return 'weak';
}

const strengthLabel = {
  weak: 'Force du mot de passe : faible',
  medium: 'Force du mot de passe : moyenne',
  strong: 'Force du mot de passe : forte',
} as const;

function barFilled(strength: 'weak' | 'medium' | 'strong', index: 0 | 1 | 2): string {
  const inactive = 'bg-gray-200 dark:bg-zinc-700';
  if (strength === 'weak') return index === 0 ? 'bg-red-400' : inactive;
  if (strength === 'medium') return index <= 1 ? 'bg-amber-400' : inactive;
  return 'bg-emerald-500';
}

export default function RegisterScreen() {
  const [state, dispatch] = useReducer(registerReducer, initialState);

  const onSubmit = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      dispatch({ type: 'submit_error', message: 'Connexion requise' });
      return;
    }

    if (!state.fullName.trim() || !state.email.trim() || !state.password.trim()) {
      dispatch({ type: 'submit_error', message: 'Nom complet, email et mot de passe sont obligatoires.' });
      return;
    }

    if (state.role === 'cardiologue' && !state.pseudo.trim()) {
      dispatch({
        type: 'field_error',
        field: 'pseudo',
        message: 'Le pseudo public est obligatoire pour un cardiologue interpréteur.',
      });
      return;
    }

    dispatch({ type: 'submit_start' });

    try {
      await api.post<{ message: string }>('/auth/register', {
        email: state.email.trim().toLowerCase(),
        password: state.password,
        fullName: state.fullName.trim(),
        role: state.role,
        specialty: state.specialty.trim() || undefined,
        cnom: state.cnom.trim() || undefined,
        pseudo: state.role === 'cardiologue' ? state.pseudo.trim() : undefined,
      });
      dispatch({ type: 'submit_success' });
      Alert.alert(
        'Inscription',
        'Compte créé, en attente d\'activation admin.',
        [{ text: 'OK' }],
      );
    } catch (e) {
      dispatch({ type: 'submit_error', message: getApiErrorMessage(e) });
    }
  }, [state]);

  const strength = passwordStrength(state.password);

  if (state.success) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-900 px-6 pt-16 justify-center">
        <Text accessibilityRole="header" className="text-xl font-bold text-gray-900 dark:text-zinc-100 text-center mb-2">
          Inscription enregistrée
        </Text>
        <Text className="text-gray-600 dark:text-zinc-400 text-center mb-8 text-base">
          Compte créé, en attente d&apos;activation admin.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retour à la connexion"
          className="bg-indigo-600 rounded-xl h-12 items-center justify-center"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold text-base">Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-indigo-700 dark:bg-indigo-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="items-center pt-12 pb-6 px-6">
          <Text className="text-white text-2xl font-bold">Xpress ECG</Text>
          <Text className="text-indigo-200 text-sm mt-1">Créer un compte professionnel</Text>
        </View>

        <View className="flex-1 bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-6 pb-10">
          <Text accessibilityRole="header" className="text-gray-800 dark:text-zinc-100 text-xl font-bold mb-4">
            Nouveau compte
          </Text>

          <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-2">Vous êtes</Text>
          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Médecin prescripteur"
              accessibilityState={{ selected: state.role === 'medecin' }}
              className={`flex-1 py-2.5 rounded-xl border-2 items-center ${
                state.role === 'medecin' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-zinc-600'
              }`}
              onPress={() => dispatch({ type: 'set_role', role: 'medecin' })}
              disabled={state.loading}
            >
              <Text className={`text-sm font-semibold ${state.role === 'medecin' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-zinc-400'}`}>
                Médecin prescripteur
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cardiologue interpréteur"
              accessibilityState={{ selected: state.role === 'cardiologue' }}
              className={`flex-1 py-2.5 rounded-xl border-2 items-center ${
                state.role === 'cardiologue' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-zinc-600'
              }`}
              onPress={() => dispatch({ type: 'set_role', role: 'cardiologue' })}
              disabled={state.loading}
            >
              <Text className={`text-xs font-semibold text-center ${state.role === 'cardiologue' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-zinc-400'}`}>
                Cardiologue interpréteur
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1">Nom complet *</Text>
            <TextInput
              accessibilityLabel="Nom complet"
              className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              value={state.fullName}
              onChangeText={(v) => dispatch({ type: 'set_field', field: 'fullName', value: v })}
              editable={!state.loading}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1">Email *</Text>
            <TextInput
              accessibilityLabel="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              value={state.email}
              onChangeText={(v) => dispatch({ type: 'set_field', field: 'email', value: v })}
              editable={!state.loading}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1">Mot de passe *</Text>
            <TextInput
              accessibilityLabel="Mot de passe"
              secureTextEntry
              className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              value={state.password}
              onChangeText={(v) => dispatch({ type: 'set_field', field: 'password', value: v })}
              editable={!state.loading}
            />
            {state.password.length > 0 ? (
              <View
                className="flex-row gap-1 mt-2"
                accessibilityRole="text"
                accessibilityLabel={strengthLabel[strength]}
              >
                <View className={`h-1 flex-1 rounded-full ${barFilled(strength, 0)}`} />
                <View className={`h-1 flex-1 rounded-full ${barFilled(strength, 1)}`} />
                <View className={`h-1 flex-1 rounded-full ${barFilled(strength, 2)}`} />
              </View>
            ) : null}
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1">Spécialité (optionnel)</Text>
            <TextInput
              className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              value={state.specialty}
              onChangeText={(v) => dispatch({ type: 'set_field', field: 'specialty', value: v })}
              editable={!state.loading}
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1">Numéro CNOM (optionnel)</Text>
            <TextInput
              className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              value={state.cnom}
              onChangeText={(v) => dispatch({ type: 'set_field', field: 'cnom', value: v })}
              editable={!state.loading}
            />
          </View>

          {state.role === 'cardiologue' ? (
            <View className="mb-3">
              <Text className="text-gray-600 dark:text-zinc-300 text-sm font-medium mb-1">Pseudo public *</Text>
              <TextInput
                accessibilityLabel="Pseudo public Give & Get"
                accessibilityHint="Identifiant public dans le classement"
                placeholder="ex. DrCardio_Brazzaville"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                className="border border-gray-200 dark:border-zinc-600 rounded-xl px-4 h-12 text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                value={state.pseudo}
                onChangeText={(v) => dispatch({ type: 'set_field', field: 'pseudo', value: v })}
                editable={!state.loading}
              />
              <Text className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Identifiant public dans le classement</Text>
              {state.fieldErrors.pseudo ? (
                <Text accessibilityRole="alert" className="text-red-600 dark:text-red-400 text-sm mt-2">
                  {state.fieldErrors.pseudo}
                </Text>
              ) : null}
            </View>
          ) : null}

          {state.error ? (
            <Text accessibilityRole="alert" className="text-red-600 dark:text-red-400 text-sm mb-3">
              {state.error}
            </Text>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Créer mon compte"
            accessibilityState={{ disabled: state.loading, busy: state.loading }}
            className="bg-indigo-600 rounded-xl h-12 items-center justify-center mb-4"
            onPress={onSubmit}
            disabled={state.loading}
          >
            {state.loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">S&apos;inscrire</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
