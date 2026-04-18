/**
 * Écran notifications in-app pour le cardiologue.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return 'À l\'instant';
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(dateStr));
}

const TYPE_ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  ecg_assigned: { name: 'pulse', color: '#6366f1' },
  ecg_completed: { name: 'checkmark-circle', color: '#16a34a' },
  report_ready: { name: 'document-text', color: '#0284c7' },
  second_opinion_request: { name: 'people', color: '#7c3aed' },
  urgent: { name: 'alert-circle', color: '#dc2626' },
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { notifications, loading, markRead, markAllRead, refetch } = useNotifications(!!user?.id);

  const handlePress = useCallback((notif: AppNotification) => {
    if (!notif.read) markRead(notif.id);
    if (notif.ecg_record_id) {
      router.push(`/(cardiologue)/interpret/${notif.ecg_record_id}` as Href);
    }
  }, [markRead]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={joyful.primary} />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Notifications</Text>
            {unreadCount > 0 && (
              <View className="bg-red-500 rounded-full px-2 py-0.5">
                <Text className="text-white text-[10px] font-bold">{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text className="text-xs font-semibold" style={{ color: joyful.primary }}>
                Tout lire
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />
        }
      >
        {loading && notifications.length === 0 ? (
          <View className="py-20 items-center">
            <ActivityIndicator color={joyful.primary} size="large" />
          </View>
        ) : notifications.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="notifications-off-outline" size={40} color="#d1d5db" />
            <Text className="text-center text-gray-500 dark:text-zinc-400 text-sm mt-3">
              Aucune notification
            </Text>
          </View>
        ) : (
          notifications.map(notif => {
            const icon = TYPE_ICON[notif.type] ?? { name: 'notifications' as keyof typeof Ionicons.glyphMap, color: '#6b7280' };
            return (
              <TouchableOpacity
                key={notif.id}
                className={`rounded-2xl p-4 mb-2 border ${
                  notif.read
                    ? 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
                    : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                }`}
                activeOpacity={0.8}
                onPress={() => handlePress(notif)}
              >
                <View className="flex-row items-start gap-3">
                  <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 items-center justify-center mt-0.5">
                    <Ionicons name={icon.name} size={16} color={icon.color} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-0.5">
                      <Text
                        className={`text-sm font-semibold ${notif.read ? 'text-gray-700 dark:text-zinc-300' : 'text-gray-900 dark:text-zinc-100'}`}
                        numberOfLines={1}
                      >
                        {notif.title}
                      </Text>
                      {!notif.read && (
                        <View className="w-2 h-2 rounded-full bg-indigo-500 ml-2" />
                      )}
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-zinc-400 leading-4" numberOfLines={2}>
                      {notif.message}
                    </Text>
                    <Text className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                      {timeAgo(notif.created_at)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
