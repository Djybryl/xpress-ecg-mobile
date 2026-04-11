import React, {
  createContext, useCallback, useContext, useRef, useState, type ReactNode,
} from 'react';
import {
  View, Text, Animated, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONFIG: Record<ToastType, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  success: { bg: '#065f46', icon: 'checkmark-circle', iconColor: '#6ee7b7' },
  error:   { bg: '#991b1b', icon: 'alert-circle',     iconColor: '#fca5a5' },
  info:    { bg: '#1e40af', icon: 'information-circle', iconColor: '#93c5fd' },
  warning: { bg: '#92400e', icon: 'warning',           iconColor: '#fcd34d' },
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const cfg = TOAST_CONFIG[item.type];

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
      ]).start(onDismiss);
    }, item.duration ?? 3000);

    return () => clearTimeout(timer);
  }, [item.duration, onDismiss, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], marginBottom: 8 }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onDismiss}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cfg.bg, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
      >
        <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
        <Text style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 18 }}>
          {item.message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const counterRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = `toast-${++counterRef.current}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error   = useCallback((msg: string) => showToast(msg, 'error', 4000), [showToast]);
  const info    = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast]);

  const value: ToastContextValue = { showToast, success, error, info, warning };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Overlay — en dehors du flux, toujours au-dessus */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + (Platform.OS === 'ios' ? 8 : 16), left: 16, right: 16, zIndex: 9999 }}
      >
        {toasts.map(toast => (
          <ToastView key={toast.id} item={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider');
  return ctx;
}
