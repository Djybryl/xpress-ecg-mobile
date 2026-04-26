import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/apiClient';

interface PrescriberDocument {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  file_url?: string | null;
}

const STATUS_CONFIG: Record<PrescriberDocument['status'], {
  label: string;
  bg: string;
  text: string;
  icon: 'hourglass-outline' | 'checkmark-circle' | 'close-circle';
}> = {
  pending:  { label: 'En attente',  bg: '#fffbeb', text: '#d97706', icon: 'hourglass-outline' },
  approved: { label: 'Validé',      bg: '#f0fdf4', text: '#16a34a', icon: 'checkmark-circle' },
  rejected: { label: 'Refusé',      bg: '#fef2f2', text: '#dc2626', icon: 'close-circle' },
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(dateStr));
}

function DocumentCard({ doc }: { doc: PrescriberDocument }) {
  const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending;

  return (
    <View
      className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none"
    >
      <View className="flex-row items-center">
        {/* Icône document */}
        <View className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 items-center justify-center mr-3">
          <Ionicons name="document-outline" size={20} color="#4f46e5" />
        </View>

        <View className="flex-1 mr-2">
          <Text
            className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-0.5"
            numberOfLines={1}
          >
            {doc.name}
          </Text>
          <Text className="text-[11px] text-gray-400 dark:text-zinc-500">
            Déposé le {formatDate(doc.created_at)}
          </Text>
        </View>

        {/* Badge statut */}
        <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={cfg.icon} size={12} color={cfg.text} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.text }}>{cfg.label}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PrescriberDocumentsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  const [documents, setDocuments] = useState<PrescriberDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isVerified = user?.prescriberGateStatus === 'verified';

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.get<PrescriberDocument[] | { documents?: PrescriberDocument[] }>(
        '/prescriber/documents',
      );
      const list = Array.isArray(res)
        ? res
        : ((res as { documents?: PrescriberDocument[] }).documents ?? []);
      setDocuments(list);
    } catch {
      // ignore — liste vide par défaut
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
  }, [fetchDocuments]);

  const handlePickAndUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'application/octet-stream';
      const fileName = asset.name ?? `document-${Date.now()}`;

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      } as never);

      setUploading(true);
      try {
        await api.upload('/prescriber/documents', formData);
        await fetchDocuments();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Succès', 'Document envoyé avec succès');
      } catch (e) {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'envoyer le document');
      } finally {
        setUploading(false);
      }
    } catch {
      // annulation picker — ne rien faire
    }
  }, [fetchDocuments]);

  return (
    <View
      className="flex-1 dark:bg-zinc-950"
      style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}
    >
      {/* Header */}
      <View style={{
        backgroundColor: joyful.stepBarBg,
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
        borderBottomWidth: 2, borderBottomColor: joyful.tabBarBorder,
      }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold dark:text-violet-200" style={{ color: joyful.primaryDark }}>
              Mes justificatifs
            </Text>
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {loading ? '…' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ backgroundColor: joyful.primaryMuted, padding: 8, borderRadius: 10 }}
          >
            <Ionicons name="refresh" size={16} color={joyful.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing
        ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#4f46e5" size="large" />
          </View>
        )
        : (
          <ScrollView
            className="flex-1 px-4"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
            }
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          >
            {/* Bandeau d'info vérification en cours */}
            {!isVerified && (
              <View
                style={{
                  backgroundColor: '#eff6ff',
                  borderLeftWidth: 4,
                  borderLeftColor: '#3b82f6',
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <Ionicons name="information-circle" size={18} color="#2563eb" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 18 }}>
                  Vos documents sont en cours de vérification. Vous pouvez consulter et envoyer des ECG pendant cette période.
                </Text>
              </View>
            )}

            {/* Liste */}
            {documents.length === 0
              ? (
                <View className="items-center mt-12 px-6">
                  <Ionicons name="shield-checkmark-outline" size={52} color="#9ca3af" />
                  <Text className="text-gray-600 dark:text-zinc-300 font-semibold text-center mt-3 text-base">
                    Aucun justificatif déposé
                  </Text>
                  <Text className="text-gray-400 dark:text-zinc-500 text-xs text-center mt-2 leading-relaxed">
                    Déposez vos justificatifs d'exercice pour être vérifié{'\n'}(ONMC, diplôme, autorisation d'exercice)
                  </Text>
                </View>
              )
              : documents.map(doc => <DocumentCard key={doc.id} doc={doc} />)
            }
          </ScrollView>
        )
      }

      {/* FAB "+" */}
      <TouchableOpacity
        onPress={handlePickAndUpload}
        disabled={uploading}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: uploading ? '#a5b4fc' : '#4f46e5',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: '#4f46e5',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }}
        activeOpacity={0.85}
      >
        {uploading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name="add" size={26} color="#fff" />
        }
      </TouchableOpacity>
    </View>
  );
}
