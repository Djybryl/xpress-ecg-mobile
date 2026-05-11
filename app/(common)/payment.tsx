import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { writeCrcPaymentReturn, type CrcPaymentBridgeFlow } from '@/lib/crcPaymentBridge';

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

type ProviderChoice = 'momo' | 'cinetpay';

export default function CommonPaymentScreen() {
  const params = useLocalSearchParams<{
    amount: string;
    description?: string;
    flow?: string;
    providerPref?: string;
    phonePref?: string;
  }>();
  const amountNum = Math.max(1, parseInt(String(params.amount ?? '0'), 10) || 0);
  const description = String(params.description ?? 'Paiement Xpress ECG');
  const flow: CrcPaymentBridgeFlow =
    params.flow === 'crc-topup' ? 'crc-topup' : 'crc-register';

  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState<ProviderChoice>('momo');
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef(false);

  useEffect(() => {
    if (params.providerPref === 'cinetpay') setProvider('cinetpay');
    if (params.providerPref === 'momo') setProvider('momo');
    if (params.phonePref) setPhone(String(params.phonePref));
  }, [params.providerPref, params.phonePref]);

  const finishSuccess = useCallback(
    async (paymentRef: string) => {
      await writeCrcPaymentReturn({
        paymentRef,
        amount: amountNum,
        flow,
      });
      pollingRef.current = false;
      setBusy(false);
      router.back();
    },
    [amountNum, flow],
  );

  const pollUntilDone = useCallback(
    async (paymentId: string, externalRef: string) => {
      for (let i = 0; i < 90; i++) {
        if (!pollingRef.current) return;
        const st = await api.get<{ status: 'pending' | 'success' | 'failed' }>(
          `/payments/${paymentId}/status`,
        );
        if (st.status === 'success') {
          await finishSuccess(externalRef);
          return;
        }
        if (st.status === 'failed') {
          pollingRef.current = false;
          setBusy(false);
          Alert.alert('Paiement', 'Le paiement a échoué.');
          return;
        }
        await sleep(2000);
      }
      pollingRef.current = false;
      setBusy(false);
      Alert.alert('Paiement', 'Délai dépassé — vérifiez le statut dans votre espace ou réessayez.');
    },
    [finishSuccess],
  );

  const startPayment = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert('Connexion requise', 'Connectez-vous à Internet pour payer.');
      return;
    }

    if (provider === 'momo' && !phone.trim()) {
      Alert.alert('Téléphone', 'Indiquez le numéro Mobile Money MTN.');
      return;
    }

    setBusy(true);
    pollingRef.current = true;
    try {
      const out = await api.post<{
        payment_id: string;
        external_ref: string;
        payment_url?: string;
        detail?: string;
      }>('/payments/initiate', {
        amount_fcfa: amountNum,
        provider,
        phone: phone.trim() || undefined,
      });

      if (out.payment_url) {
        await Linking.openURL(out.payment_url);
      } else if (out.detail) {
        Alert.alert('Mobile Money', out.detail);
      }

      await pollUntilDone(out.payment_id, out.external_ref);
    } catch (e) {
      pollingRef.current = false;
      setBusy(false);
      Alert.alert('Erreur', getApiErrorMessage(e));
    }
  }, [amountNum, phone, provider, pollUntilDone]);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-zinc-950" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Stack.Screen
        options={{
          title: 'Paiement',
          headerBackTitle: 'Retour',
        }}
      />
      <Text
        className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-1"
        accessibilityRole="header"
      >
        {description}
      </Text>
      <Text className="text-2xl font-extrabold text-violet-700 dark:text-violet-300 mb-4">
        {amountNum.toLocaleString('fr-FR')} FCFA
      </Text>

      <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Moyen de paiement</Text>
      <View className="flex-row gap-2 mb-3">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl border ${provider === 'momo' ? 'bg-violet-600 border-violet-600' : 'border-gray-200 dark:border-zinc-700'}`}
          onPress={() => setProvider('momo')}
          accessibilityRole="button"
          accessibilityLabel="Payer avec Mobile Money MTN"
          accessibilityState={{ selected: provider === 'momo' }}
        >
          <Text
            className={`text-center text-sm font-semibold ${provider === 'momo' ? 'text-white' : 'text-gray-800 dark:text-zinc-200'}`}
          >
            MTN MoMo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl border ${provider === 'cinetpay' ? 'bg-violet-600 border-violet-600' : 'border-gray-200 dark:border-zinc-700'}`}
          onPress={() => setProvider('cinetpay')}
          accessibilityRole="button"
          accessibilityLabel="Payer avec Orange Money ou carte (CinetPay)"
          accessibilityState={{ selected: provider === 'cinetpay' }}
        >
          <Text
            className={`text-center text-sm font-semibold ${provider === 'cinetpay' ? 'text-white' : 'text-gray-800 dark:text-zinc-200'}`}
          >
            Orange / Carte
          </Text>
        </TouchableOpacity>
      </View>

      {provider === 'momo' ? (
        <View className="mb-4">
          <Text className="text-xs text-gray-500 mb-1">Téléphone (2376… ou 6…)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="6XXXXXXXX"
            placeholderTextColor="#9ca3af"
            className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-gray-900 dark:text-zinc-100"
            accessibilityLabel="Numéro téléphone Mobile Money"
          />
        </View>
      ) : (
        <View className="mb-4">
          <Text className="text-xs text-gray-500 mb-1">Téléphone (optionnel pour CinetPay)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="6XXXXXXXX"
            placeholderTextColor="#9ca3af"
            className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-gray-900 dark:text-zinc-100"
            accessibilityLabel="Numéro téléphone pour CinetPay"
          />
        </View>
      )}

      <TouchableOpacity
        className="bg-violet-600 rounded-xl py-4 items-center mb-3"
        onPress={() => { void startPayment(); }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Confirmer et lancer le paiement"
        accessibilityState={{ disabled: busy }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold">Payer</Text>
        )}
      </TouchableOpacity>

      <Text className="text-xs text-gray-500 text-center" accessibilityRole="text">
        Après validation sur votre téléphone ou sur la page sécurisée, le statut est vérifié automatiquement.
      </Text>
    </ScrollView>
  );
}
