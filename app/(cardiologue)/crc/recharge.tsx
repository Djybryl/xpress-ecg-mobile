import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { readAndClearCrcPaymentReturn } from '@/lib/crcPaymentBridge';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useCrcAccount } from '@/hooks/useCrcAccount';

const PRESETS = [5000, 10000, 20000, 50000];

type PayMethod = 'momo' | 'cinetpay';

export default function CrcRechargeScreen() {
  const { user } = useAuth();
  const { success } = useToast();
  const { refetch: refetchWallet } = useCrcAccount(user?.role === 'cardiologue');
  const [amountStr, setAmountStr] = useState('10000');
  const [method, setMethod] = useState<PayMethod>('momo');
  const [phone, setPhone] = useState('');

  const amount = Math.max(0, parseInt(amountStr.replace(/\D/g, ''), 10) || 0);
  const nEcg = Math.floor(amount / 400);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const ret = await readAndClearCrcPaymentReturn();
        if (cancelled || !ret || ret.flow !== 'crc-topup' || !ret.paymentRef) return;
        const topAmount = ret.amount;
        if (topAmount == null || topAmount < 1) {
          Alert.alert('Recharge', 'Montant de paiement manquant.');
          return;
        }
        try {
          const out = await api.post<{ solde_fcfa: number; is_active: boolean }>('/crc/wallet/topup', {
            amount: topAmount,
            paymentRef: ret.paymentRef,
          });
          success(`Nouveau solde CRC : ${out.solde_fcfa.toLocaleString('fr-FR')} FCFA`);
          await refetchWallet();
        } catch (e) {
          Alert.alert('Recharge', getApiErrorMessage(e));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [refetchWallet, success]),
  );

  const goPay = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert('Connexion requise', 'Connectez-vous à Internet avant le paiement.');
      return;
    }
    if (amount < 1000) {
      Alert.alert('Montant', 'Le minimum est de 1 000 FCFA.');
      return;
    }
    if (method === 'momo' && !phone.trim()) {
      Alert.alert('Téléphone', 'Numéro requis pour MTN MoMo.');
      return;
    }
    router.push({
      pathname: '/(common)/payment',
      params: {
        amount: String(amount),
        description: 'Recharge CRC',
        flow: 'crc-topup',
        providerPref: method,
        phonePref: phone.trim() || undefined,
      },
    } as unknown as Href);
  }, [amount, method, phone]);

  if (user?.role !== 'cardiologue') {
    return (
      <View className="flex-1 justify-center p-6">
        <Stack.Screen options={{ title: 'Recharger' }} />
        <Text className="text-center">Réservé aux cardiologues.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-zinc-950" contentContainerStyle={{ padding: 20 }}>
      <Stack.Screen options={{ title: 'Recharger le CRC' }} />

      <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">Montant (FCFA)</Text>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p}
            className={`px-3 py-2 rounded-xl border ${amount === p ? 'bg-violet-600 border-violet-600' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}
            onPress={() => setAmountStr(String(p))}
            accessibilityRole="button"
            accessibilityLabel={`Montant prédéfini ${p} francs CFA`}
            accessibilityState={{ selected: amount === p }}
          >
            <Text className={`text-sm font-semibold ${amount === p ? 'text-white' : 'text-gray-800 dark:text-zinc-200'}`}>
              {p.toLocaleString('fr-FR')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        value={amountStr}
        onChangeText={setAmountStr}
        keyboardType="number-pad"
        className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-3 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 mb-2"
        accessibilityLabel="Montant de recharge en francs CFA"
      />
      <Text className="text-violet-700 dark:text-violet-300 font-medium mb-4" accessibilityRole="text">
        Permet de traiter environ {nEcg} ECG réseau (à 400 FCFA l&apos;unité).
      </Text>

      <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Moyen</Text>
      <View className="flex-row gap-2 mb-3">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl border items-center ${method === 'momo' ? 'bg-violet-600 border-violet-600' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}
          onPress={() => setMethod('momo')}
          accessibilityRole="button"
          accessibilityLabel="Moyen de paiement MTN MoMo"
          accessibilityState={{ selected: method === 'momo' }}
        >
          <Text className={`font-semibold ${method === 'momo' ? 'text-white' : 'text-gray-800 dark:text-zinc-200'}`}>
            MTN MoMo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl border items-center ${method === 'cinetpay' ? 'bg-violet-600 border-violet-600' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}
          onPress={() => setMethod('cinetpay')}
          accessibilityRole="button"
          accessibilityLabel="Moyen de paiement Orange ou Visa via CinetPay"
          accessibilityState={{ selected: method === 'cinetpay' }}
        >
          <Text className={`font-semibold text-center ${method === 'cinetpay' ? 'text-white' : 'text-gray-800 dark:text-zinc-200'}`}>
            Orange / Visa
          </Text>
        </TouchableOpacity>
      </View>

      {method === 'momo' ? (
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="6XXXXXXXX"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-3 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 mb-4"
          accessibilityLabel="Numéro téléphone Mobile Money"
        />
      ) : null}

      <TouchableOpacity
        className="bg-violet-600 rounded-xl py-4 items-center"
        onPress={() => { void goPay(); }}
        accessibilityRole="button"
        accessibilityLabel="Continuer vers le paiement de recharge CRC"
      >
        <Text className="text-white font-bold">Payer</Text>
      </TouchableOpacity>

      <Text className="text-xs text-gray-500 mt-4 text-center" accessibilityRole="text">
        Après un paiement réussi, le solde est crédité automatiquement au retour sur cet écran.
      </Text>
    </ScrollView>
  );
}
