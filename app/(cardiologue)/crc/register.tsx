import { useReducer, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { readAndClearCrcPaymentReturn } from '@/lib/crcPaymentBridge';
import { useAuth } from '@/providers/AuthProvider';

type Step = 1 | 2 | 3 | 4;

interface RegState {
  step: Step;
  loading: boolean;
  error: string | null;
  paymentRef: string | null;
  crcId: string | null;
}

type RegAction =
  | { type: 'SET_LOADING'; v: boolean }
  | { type: 'SET_ERROR'; v: string | null }
  | { type: 'GO_STEP2' }
  | { type: 'PAYMENT_OK'; ref: string }
  | { type: 'REGISTER_OK'; crcId: string };

function reducer(s: RegState, a: RegAction): RegState {
  switch (a.type) {
    case 'SET_LOADING':
      return { ...s, loading: a.v };
    case 'SET_ERROR':
      return { ...s, error: a.v };
    case 'GO_STEP2':
      return { ...s, step: 2, error: null };
    case 'PAYMENT_OK':
      return { ...s, step: 3, paymentRef: a.ref, error: null };
    case 'REGISTER_OK':
      return { ...s, step: 4, crcId: a.crcId, loading: false, error: null };
    default:
      return s;
  }
}

const initial: RegState = {
  step: 1,
  loading: false,
  error: null,
  paymentRef: null,
  crcId: null,
};

export default function CrcRegisterScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initial);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const ret = await readAndClearCrcPaymentReturn();
        if (cancelled || !ret || ret.flow !== 'crc-register' || !ret.paymentRef) return;
        dispatch({ type: 'PAYMENT_OK', ref: ret.paymentRef });
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const finalize = useCallback(async () => {
    if (!state.paymentRef?.trim()) {
      dispatch({ type: 'SET_ERROR', v: 'Référence de paiement manquante.' });
      return;
    }
    dispatch({ type: 'SET_LOADING', v: true });
    dispatch({ type: 'SET_ERROR', v: null });
    try {
      const out = await api.post<{ crc_id: string; wallet: { solde_fcfa: number } }>('/crc/register', {
        paymentRef: state.paymentRef.trim(),
      });
      dispatch({ type: 'REGISTER_OK', crcId: out.crc_id });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', v: getApiErrorMessage(e) });
    } finally {
      dispatch({ type: 'SET_LOADING', v: false });
    }
  }, [state.paymentRef]);

  if (user?.role !== 'cardiologue') {
    return (
      <View className="flex-1 justify-center p-6">
        <Stack.Screen options={{ title: 'Activer le CRC' }} />
        <Text className="text-center">Réservé aux cardiologues.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-zinc-950"
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
    >
      <Stack.Screen options={{ title: 'Activer le CRC' }} />

      {state.step === 1 && (
        <View>
          <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-2" accessibilityRole="header">
            Réseau CRC
          </Text>
          <Text className="text-gray-600 dark:text-zinc-400 mb-3 leading-6">
            Activez votre réseau cardiologue : visibilité auprès des prescripteurs, file dédiée et facturation par acte.
          </Text>
          <Text className="text-gray-800 dark:text-zinc-300 mb-4 leading-6">
            • Inscription unique : <Text className="font-bold">10 000 FCFA</Text>
            {'\n'}• Coût par ECG réseau : <Text className="font-bold">400 FCFA</Text> (prélevé sur votre solde)
          </Text>
          <TouchableOpacity
            className="bg-violet-600 rounded-xl py-4 items-center"
            onPress={() => dispatch({ type: 'GO_STEP2' })}
            accessibilityRole="button"
            accessibilityLabel="Activer mon réseau, étape suivante"
          >
            <Text className="text-white font-bold">Activer mon réseau →</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.step === 2 && (
        <View>
          <Text className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">Paiement</Text>
          <Text className="text-gray-600 dark:text-zinc-400 mb-4">
            Réglez 10 000 FCFA pour l&apos;inscription CRC. Vous reviendrez ici après confirmation du paiement.
          </Text>
          <TouchableOpacity
            className="bg-violet-600 rounded-xl py-4 items-center"
            onPress={() =>
              router.push({
                pathname: '/(common)/payment',
                params: {
                  amount: '10000',
                  description: 'Inscription CRC',
                  flow: 'crc-register',
                },
              } as unknown as Href)
            }
            accessibilityRole="button"
            accessibilityLabel="Ouvrir l&apos;écran de paiement d&apos;inscription CRC"
          >
            <Text className="text-white font-bold">Payer 10 000 FCFA</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.step === 3 && (
        <View>
          <Text className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">Finalisation</Text>
          <Text className="text-gray-600 dark:text-zinc-400 mb-2">Référence paiement :</Text>
          <Text
            className="font-mono text-sm text-gray-900 dark:text-zinc-100 mb-4"
            selectable
            accessibilityLabel={`Référence de paiement ${state.paymentRef ?? ''}`}
          >
            {state.paymentRef}
          </Text>
          {state.error ? (
            <Text className="text-red-600 mb-3" accessibilityRole="alert">
              {state.error}
            </Text>
          ) : null}
          <TouchableOpacity
            className="bg-violet-600 rounded-xl py-4 items-center"
            onPress={() => { void finalize(); }}
            disabled={state.loading}
            accessibilityRole="button"
            accessibilityLabel="Finaliser l&apos;activation du compte CRC"
            accessibilityState={{ disabled: state.loading }}
          >
            {state.loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Finaliser</Text>}
          </TouchableOpacity>
        </View>
      )}

      {state.step === 4 && (
        <View>
          <Text
            className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-4"
            accessibilityRole="header"
          >
            Réseau CRC activé !
          </Text>
          <TouchableOpacity
            className="bg-violet-600 rounded-xl py-4 items-center mb-3"
            onPress={() => router.push('/(cardiologue)/crc/recharge' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Recharger le portefeuille CRC maintenant"
          >
            <Text className="text-white font-bold">Recharger maintenant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="border border-gray-300 dark:border-zinc-600 rounded-xl py-4 items-center"
            onPress={() => router.replace('/(cardiologue)/' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Retour à l&apos;accueil cardiologue"
          >
            <Text className="text-gray-800 dark:text-zinc-200 font-semibold">Plus tard</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
