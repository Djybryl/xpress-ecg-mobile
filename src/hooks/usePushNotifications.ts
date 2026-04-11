/**
 * usePushNotifications — enregistrement du token push et routage des notifications par rôle.
 *
 * À appeler une seule fois depuis le composant racine ou AuthProvider après login.
 *
 * Canaux Android par rôle :
 *   - medecin       → rapport disponible
 *   - cardiologue   → nouvel ECG assigné
 *   - secretaire    → nouvelle inscription à valider
 *   - admin         → alerte seuil critique
 */
import { useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { UserRole } from '@/types/user';
import { api } from '@/lib/apiClient';

/**
 * Vérifie si l'app tourne sur un vrai appareil physique sans expo-device
 * (native module qui nécessite rebuild). On se base sur l'absence de
 * l'émulateur Android et du simulateur iOS via les constantes Expo.
 */
function isPhysicalDevice(): boolean {
  // Sur web, pas de push
  if (Platform.OS === 'web') return false;
  // Constants.isDevice est disponible sans module natif sur SDK 50+
  const c = Constants as unknown as { isDevice?: boolean };
  if (typeof c.isDevice === 'boolean') return c.isDevice;
  // Fallback : si pas de deviceName connu, on suppose vrai appareil
  return true;
}

// Comportement par défaut : afficher les notifs même si l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Routes de destination par type de notification */
function resolveRoute(data: Record<string, unknown>, role: UserRole): string | null {
  const type = typeof data?.type === 'string' ? data.type : '';
  switch (role) {
    case 'medecin':
      if (type === 'report_ready' || type === 'ecg_completed') return '/(medecin)/reports';
      return '/(medecin)';
    case 'cardiologue':
      if (type === 'ecg_assigned' && typeof data?.ecg_id === 'string') {
        return `/(cardiologue)/interpret/${data.ecg_id}`;
      }
      return '/(cardiologue)/queue';
    case 'secretaire':
      if (type === 'prescriber_pending') return '/(secretaire)/prescribers';
      return '/(secretaire)';
    case 'admin':
      if (type === 'critical_threshold') return '/(admin)';
      if (type === 'prescriber_pending') return '/(admin)/prescribers';
      return '/(admin)';
    default:
      return null;
  }
}

async function registerForPushNotificationsAsync(role: UserRole): Promise<string | null> {
  if (!isPhysicalDevice()) {
    console.warn('[Push] Notifications push non disponibles sur simulateur/web');
    return null;
  }

  // Créer les canaux Android par rôle
  if (Platform.OS === 'android') {
    const channelDefs: Record<UserRole, { id: string; name: string; importance: Notifications.AndroidImportance }> = {
      medecin:     { id: 'medecin',    name: 'Rapports ECG', importance: Notifications.AndroidImportance.HIGH },
      cardiologue: { id: 'cardiologue', name: 'File ECG', importance: Notifications.AndroidImportance.MAX },
      secretaire:  { id: 'secretaire', name: 'Inscriptions', importance: Notifications.AndroidImportance.HIGH },
      admin:       { id: 'admin',      name: 'Alertes admin', importance: Notifications.AndroidImportance.HIGH },
    };
    const ch = channelDefs[role];
    if (ch) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: ch.importance,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
      });
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission refusée');
    return null;
  }

  const projectId: string | undefined =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return token.data;
}

interface UsePushNotificationsOptions {
  userId: string | null;
  role: UserRole | null;
  enabled: boolean;
}

export function usePushNotifications({ userId, role, enabled }: UsePushNotificationsOptions) {
  const tokenSentRef = useRef<string | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  const sendTokenToServer = useCallback(async (token: string, currentUserId: string) => {
    if (tokenSentRef.current === token) return;
    try {
      await api.post('/notifications/register-push-token', { token, user_id: currentUserId });
      tokenSentRef.current = token;
    } catch {
      // Non bloquant — on réessaiera au prochain montage
    }
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !role) return;

    let mounted = true;

    void registerForPushNotificationsAsync(role).then(token => {
      if (token && mounted && userId) {
        void sendTokenToServer(token, userId);
      }
    });

    // Listener : tap sur une notification quand l'app est en arrière-plan
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      if (!role) return;
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const target = resolveRoute(data, role);
      if (target) {
        // Petit délai pour laisser l'app se monter si elle était fermée
        setTimeout(() => {
          try {
            router.push(target as Parameters<typeof router.push>[0]);
          } catch {
            // navigation échouée (app pas encore prête)
          }
        }, 500);
      }
    });

    return () => {
      mounted = false;
      responseListenerRef.current?.remove();
      responseListenerRef.current = null;
    };
  }, [enabled, userId, role, sendTokenToServer]);
}
