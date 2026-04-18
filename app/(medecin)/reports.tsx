import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/providers/AuthProvider';
import { useReportList, type ReportItem } from '@/hooks/useReportList';
import { useTheme } from '@/providers/ThemeProvider';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { downloadReportPdfToCache } from '@/lib/saveReportPdf';
import {
  openPdfWithExternalApp,
  sharePdfFile,
  printPdfFile,
  persistPdfCopy,
  alertPdfError,
} from '@/lib/reportPdfActions';

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

type PdfModalState = {
  visible: boolean;
  localUri: string | null;
  report: ReportItem | null;
};

function ReportCard({
  report,
  onRead,
  onOpenPdfSheet,
  pdfOpening,
}: {
  report: ReportItem;
  onRead: (id: string) => void;
  onOpenPdfSheet: (report: ReportItem) => void;
  pdfOpening: boolean;
}) {
  return (
    <View
      className={`rounded-2xl mb-3 overflow-hidden border shadow-sm shadow-gray-100 dark:shadow-none ${
        report.is_read
          ? 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
          : 'bg-white dark:bg-zinc-900 border-indigo-200 dark:border-violet-600'
      }`}
    >
      {!report.is_read && (
        <View className={`h-1 w-full ${report.is_urgent ? 'bg-red-500' : 'bg-indigo-500'}`} />
      )}

      <TouchableOpacity
        className="p-4"
        onPress={() => {
          if (!report.is_read) onRead(report.id);
        }}
        activeOpacity={0.8}
      >
        <View className="flex-row items-start mb-2">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              report.is_normal ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <Text className="text-sm font-bold">{report.is_normal ? '✅' : '⚠️'}</Text>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center flex-wrap gap-1 mb-1">
              <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex-1" numberOfLines={1}>
                {report.patient_name ?? 'Patient inconnu'}
                {report.is_urgent && ' ⚡'}
              </Text>
              {!report.is_read && <View className="w-2 h-2 rounded-full bg-indigo-500" />}
            </View>

            <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-0.5">
              {report.ecg_reference ?? '—'} · {report.cardiologist_name ?? 'Cardiologue'}
            </Text>

            <Text className="text-xs text-gray-400 dark:text-zinc-500">{timeAgo(report.updated_at)}</Text>
          </View>

          <View className={`px-2 py-0.5 rounded-full ml-2 ${report.is_normal ? 'bg-green-100' : 'bg-red-100'}`}>
            <Text className={`text-[10px] font-semibold ${report.is_normal ? 'text-green-700' : 'text-red-700'}`}>
              {report.is_normal ? 'Normal' : 'Anormal'}
            </Text>
          </View>
        </View>

        {report.conclusion && (
          <Text className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed mb-3" numberOfLines={3}>
            {report.conclusion}
          </Text>
        )}
      </TouchableOpacity>

      {(report.status === 'sent' || report.status === 'validated' || !!report.pdf_url) && (
        <View className="px-4 pb-4">
          <TouchableOpacity
            className="flex-row items-center justify-center bg-indigo-50 dark:bg-violet-950 border border-indigo-200 dark:border-violet-700 rounded-xl py-2.5 gap-2"
            onPress={() => onOpenPdfSheet(report)}
            disabled={pdfOpening}
            activeOpacity={0.8}
            accessibilityLabel="Ouvrir les options du rapport PDF"
            accessibilityRole="button"
          >
            {pdfOpening ? (
              <ActivityIndicator color="#4f46e5" size="small" />
            ) : (
              <>
                <Text className="text-indigo-600 text-base">📄</Text>
                <Text className="text-indigo-700 dark:text-violet-200 text-xs font-semibold">Rapport PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState<PdfModalState>({
    visible: false,
    localUri: null,
    report: null,
  });

  const {
    reports, unreadCount, urgentUnreadCount, loading,
    refetch, markRead, markAllRead,
  } = useReportList({
    referring_doctor_id: user?.id,
    limit: 200,
    enabled: !!user?.id,
  });

  const closePdfModal = useCallback(() => {
    setPdfModal({ visible: false, localUri: null, report: null });
  }, []);

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

  const handleOpenPdfSheet = useCallback(
    async (report: ReportItem) => {
      setPdfLoading(report.id);
      try {
        const { pdf_url: signedUrl } = await api.get<{ pdf_url: string }>(`/reports/${report.id}/pdf`);
        if (!signedUrl?.startsWith('http')) {
          Alert.alert('Erreur', 'Lien du rapport indisponible. Réessayez dans un instant.');
          return;
        }

        const localUri = await downloadReportPdfToCache(signedUrl, report.id, report.patient_name);

        if (!report.is_read) await markRead(report.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setPdfModal({ visible: true, localUri, report });
      } catch (e) {
        Alert.alert('Erreur', getApiErrorMessage(e));
      } finally {
        setPdfLoading(null);
      }
    },
    [markRead],
  );

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

  const patientLabel = pdfModal.report?.patient_name ?? 'Patient';

  return (
    <View className="flex-1 dark:bg-zinc-950" style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}>
      <PdfActionsModalShell
        visible={pdfModal.visible}
        localUri={pdfModal.localUri}
        report={pdfModal.report}
        patientLabel={patientLabel}
        onClose={closePdfModal}
        joyful={joyful}
        bottomInset={insets.bottom}
      />

      <View
        style={{
          backgroundColor: joyful.stepBarBg,
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 2,
          borderBottomColor: joyful.tabBarBorder,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold dark:text-violet-200" style={{ color: joyful.primaryDark }}>
            Mes rapports ECG
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text className="text-indigo-600 dark:text-violet-300 text-xs font-medium">Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row gap-2">
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f.key
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600'
              }`}
              onPress={() => setFilter(f.key)}
            >
              <Text
                className={`text-xs font-medium ${
                  filter === f.key ? 'text-white' : 'text-gray-600 dark:text-zinc-300'
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {urgentUnreadCount > 0 && (
        <TouchableOpacity
          className="bg-red-500 mx-4 mt-3 rounded-xl px-4 py-2.5 flex-row items-center gap-2"
          onPress={() => setFilter('urgent')}
        >
          <Text className="text-white font-bold text-sm flex-1">
            🔴 {urgentUnreadCount} rapport{urgentUnreadCount > 1 ? 's' : ''} urgent
            {urgentUnreadCount > 1 ? 's' : ''} non lu{urgentUnreadCount > 1 ? 's' : ''} !
          </Text>
          <Text className="text-white text-xs">Voir →</Text>
        </TouchableOpacity>
      )}

      {loading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4f46e5" size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 mt-3"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {filtered.length === 0 ? (
            <View className="items-center mt-16">
              <Text className="text-4xl mb-3">📄</Text>
              <Text className="text-gray-600 dark:text-zinc-400 font-medium text-center">
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
                onOpenPdfSheet={handleOpenPdfSheet}
                pdfOpening={pdfLoading === r.id}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

type Joyful = ReturnType<typeof useTheme>['colors'];

function PdfActionsModalShell({
  visible,
  localUri,
  report,
  patientLabel,
  onClose,
  joyful,
  bottomInset,
}: {
  visible: boolean;
  localUri: string | null;
  report: ReportItem | null;
  patientLabel: string;
  onClose: () => void;
  joyful: Joyful;
  bottomInset: number;
}) {
  const run = async (fn: () => void | Promise<void>) => {
    try {
      await Promise.resolve(fn());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      alertPdfError(e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl px-4 pt-3 border-t border-gray-100 dark:border-zinc-800"
          style={{
            paddingBottom: bottomInset + 16,
            backgroundColor: joyful.neutral.surface,
          }}
          onPress={e => e.stopPropagation()}
        >
          <View className="w-10 h-1 rounded-full self-center mb-3" style={{ backgroundColor: joyful.neutral.border }} />
          <Text className="text-base font-bold text-center mb-1" style={{ color: joyful.neutral.text }}>
            Que faire avec ce PDF ?
          </Text>
          <Text className="text-xs text-center mb-4 opacity-80" style={{ color: joyful.neutral.textMuted }} numberOfLines={2}>
            {patientLabel}
          </Text>

          <TouchableOpacity
            className="py-3.5 px-4 rounded-xl mb-2"
            style={{ backgroundColor: joyful.primary }}
            onPress={() =>
              void run(async () => {
                if (!localUri) return;
                await openPdfWithExternalApp(localUri);
              })}
            disabled={!localUri}
            accessibilityLabel="Voir le PDF avec une application"
          >
            <Text className="text-white text-center font-semibold text-sm">Voir (lecteur PDF)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-3.5 px-4 rounded-xl border mb-2"
            style={{ borderColor: joyful.neutral.border, backgroundColor: joyful.neutral.toggleBg }}
            onPress={() =>
              void run(async () => {
                if (!localUri) return;
                await sharePdfFile(localUri);
              })}
            disabled={!localUri}
            accessibilityLabel="Partager le PDF"
          >
            <Text className="text-center font-semibold text-sm" style={{ color: joyful.neutral.text }}>
              Partager
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-3.5 px-4 rounded-xl border mb-2"
            style={{ borderColor: joyful.neutral.border }}
            onPress={() =>
              void run(async () => {
                if (!localUri) return;
                await printPdfFile(localUri);
              })}
            disabled={!localUri}
            accessibilityLabel="Imprimer le PDF"
          >
            <Text className="text-center font-semibold text-sm" style={{ color: joyful.neutral.text }}>
              Imprimer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-3.5 px-4 rounded-xl border mb-3"
            style={{ borderColor: joyful.neutral.borderStrong, backgroundColor: joyful.neutral.inputBg }}
            onPress={() =>
              void run(async () => {
                if (!localUri || !report) return;
                const { folderLabel } = await persistPdfCopy(localUri, report.id, report.patient_name);
                Alert.alert(
                  'PDF enregistré',
                  Platform.OS === 'ios'
                    ? `Copie enregistrée dans l’app. Emplacement typique : ${folderLabel}.`
                    : `Copie enregistrée dans l’espace de l’application. ${folderLabel}`,
                  [{ text: 'OK' }],
                );
              })}
            disabled={!localUri || !report}
            accessibilityLabel="Enregistrer une copie dans l’application"
          >
            <Text className="text-center font-semibold text-sm" style={{ color: joyful.neutral.textSecondary }}>
              Enregistrer dans l’app (dossier Rapports)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="py-3 px-4 rounded-xl" onPress={onClose} accessibilityLabel="Fermer">
            <Text className="text-center font-medium text-sm" style={{ color: joyful.neutral.textMuted }}>
              Fermer
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
