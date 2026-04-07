import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/providers/AuthProvider';
import { useReportList, type ReportItem } from '@/hooks/useReportList';

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

function ReportCard({
  report,
  onRead,
  onOpenPdf,
}: {
  report: ReportItem;
  onRead: (id: string) => void;
  onOpenPdf: (report: ReportItem) => void;
}) {
  return (
    <TouchableOpacity
      className={`rounded-2xl mb-3 overflow-hidden border shadow-sm shadow-gray-100 ${
        report.is_read ? 'bg-white border-gray-100' : 'bg-white border-indigo-200'
      }`}
      onPress={() => {
        if (!report.is_read) onRead(report.id);
      }}
      activeOpacity={0.8}
    >
      {/* Bandeau non lu */}
      {!report.is_read && (
        <View className={`h-1 w-full ${report.is_urgent ? 'bg-red-500' : 'bg-indigo-500'}`} />
      )}

      <View className="p-4">
        <View className="flex-row items-start mb-2">
          {/* Avatar */}
          <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            report.is_normal ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <Text className="text-sm font-bold">
              {report.is_normal ? '✅' : '⚠️'}
            </Text>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center flex-wrap gap-1 mb-1">
              <Text className="text-sm font-semibold text-gray-900 flex-1" numberOfLines={1}>
                {report.patient_name ?? 'Patient inconnu'}
                {report.is_urgent && ' ⚡'}
              </Text>
              {!report.is_read && (
                <View className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </View>

            <Text className="text-xs text-gray-500 mb-0.5">
              {report.ecg_reference ?? '—'} · {report.cardiologist_name ?? 'Cardiologue'}
            </Text>

            <Text className="text-xs text-gray-400">
              {timeAgo(report.updated_at)}
            </Text>
          </View>

          {/* Statut normal/anormal */}
          <View className={`px-2 py-0.5 rounded-full ml-2 ${report.is_normal ? 'bg-green-100' : 'bg-red-100'}`}>
            <Text className={`text-[10px] font-semibold ${report.is_normal ? 'text-green-700' : 'text-red-700'}`}>
              {report.is_normal ? 'Normal' : 'Anormal'}
            </Text>
          </View>
        </View>

        {/* Conclusion */}
        {report.conclusion && (
          <Text className="text-xs text-gray-600 leading-relaxed mb-3" numberOfLines={3}>
            {report.conclusion}
          </Text>
        )}

        {/* Actions */}
        {report.pdf_url && (
          <TouchableOpacity
            className="flex-row items-center justify-center bg-indigo-50 border border-indigo-200 rounded-xl py-2.5 gap-2"
            onPress={() => onOpenPdf(report)}
            activeOpacity={0.8}
          >
            <Text className="text-indigo-600 text-base">📄</Text>
            <Text className="text-indigo-700 text-xs font-semibold">Voir le rapport PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const {
    reports, unreadCount, urgentUnreadCount, loading,
    refetch, markRead, markAllRead,
  } = useReportList({
    referring_doctor_id: user?.id,
    limit: 200,
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filtered = reports.filter(r => {
    if (filter === 'unread') return !r.is_read;
    if (filter === 'urgent') return r.is_urgent;
    return true;
  });

  const handleOpenPdf = useCallback(async (report: ReportItem) => {
    if (!report.pdf_url) return;
    setPdfLoading(report.id);
    try {
      // Essaie d'ouvrir en partage natif (permet impression, etc.)
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const localUri = FileSystem.cacheDirectory + `rapport_${report.id}.pdf`;
        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists) {
          await FileSystem.downloadAsync(report.pdf_url, localUri);
        }
        await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Linking.openURL(report.pdf_url);
      }
      if (!report.is_read) await markRead(report.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le rapport. Vérifiez votre connexion.');
    } finally {
      setPdfLoading(null);
    }
  }, [markRead]);

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    Alert.alert(
      'Tout marquer comme lu',
      `Marquer les ${unreadCount} rapports comme lus ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            await markAllRead();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  }, [unreadCount, markAllRead]);

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: `Tous (${reports.length})` },
    { key: 'unread', label: `Non lus${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { key: 'urgent', label: `Urgents${urgentUnreadCount > 0 ? ` 🔴` : ''}` },
  ];

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-5 pb-3 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold text-gray-900">Mes rapports ECG</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text className="text-indigo-600 text-xs font-medium">Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filtres */}
        <View className="flex-row gap-2">
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f.key ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'
              }`}
              onPress={() => setFilter(f.key)}
            >
              <Text className={`text-xs font-medium ${filter === f.key ? 'text-white' : 'text-gray-600'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bannière urgent */}
      {urgentUnreadCount > 0 && (
        <TouchableOpacity
          className="bg-red-500 mx-4 mt-3 rounded-xl px-4 py-2.5 flex-row items-center gap-2"
          onPress={() => setFilter('urgent')}
        >
          <Text className="text-white font-bold text-sm flex-1">
            🔴 {urgentUnreadCount} rapport{urgentUnreadCount > 1 ? 's' : ''} urgent{urgentUnreadCount > 1 ? 's' : ''} non lu{urgentUnreadCount > 1 ? 's' : ''} !
          </Text>
          <Text className="text-white text-xs">Voir →</Text>
        </TouchableOpacity>
      )}

      {/* Liste */}
      {loading && !refreshing
        ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#4f46e5" size="large" />
          </View>
        )
        : (
          <ScrollView
            className="flex-1 px-4 mt-3"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
            }
            contentContainerStyle={{ paddingBottom: 30 }}
          >
            {filtered.length === 0 ? (
              <View className="items-center mt-16">
                <Text className="text-4xl mb-3">📄</Text>
                <Text className="text-gray-600 font-medium text-center">
                  {filter === 'unread'
                    ? 'Tous les rapports ont été lus.'
                    : filter === 'urgent'
                    ? 'Aucun rapport urgent.'
                    : 'Aucun rapport disponible.'}
                </Text>
              </View>
            ) : (
              filtered.map(r => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onRead={markRead}
                  onOpenPdf={pdfLoading === r.id
                    ? () => {}
                    : handleOpenPdf
                  }
                />
              ))
            )}
          </ScrollView>
        )
      }
    </View>
  );
}
