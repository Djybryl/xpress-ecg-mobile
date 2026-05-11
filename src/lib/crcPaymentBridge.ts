import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'xecg-crc-payment-return';

export type CrcPaymentBridgeFlow = 'crc-register' | 'crc-topup';

export type CrcPaymentBridgePayload = {
  paymentRef: string;
  amount?: number;
  flow: CrcPaymentBridgeFlow;
};

export async function writeCrcPaymentReturn(payload: CrcPaymentBridgePayload): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...payload, ts: Date.now() }));
}

export async function readAndClearCrcPaymentReturn(): Promise<CrcPaymentBridgePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const o = JSON.parse(raw) as CrcPaymentBridgePayload & { ts?: number };
    if (!o?.paymentRef || !o.flow) return null;
    return { paymentRef: o.paymentRef, amount: o.amount, flow: o.flow };
  } catch {
    return null;
  }
}
