import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePatientList, type PatientItem } from '@/hooks/usePatientList';

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? age : null;
}

function PatientCard({
  patient,
  onPress,
}: {
  patient: PatientItem;
  onPress: () => void;
}) {
  const initials = (patient.name ?? 'P').trim().slice(0, 2).toUpperCase();
  const age = calculateAge(patient.date_of_birth);
  const genderLabel = patient.gender === 'M' ? 'Homme' : patient.gender === 'F' ? 'Femme' : null;
  const ageLabel = age != null ? `${age} ans` : 'Âge non renseigné';
  const meta = [genderLabel, ageLabel].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none"
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View className="flex-row items-center">
        {/* Cercle initiales */}
        <View className="w-11 h-11 rounded-full bg-indigo-100 items-center justify-center mr-3">
          <Text className="text-sm font-bold text-indigo-600">{initials}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-0.5">
            <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex-1 mr-2" numberOfLines={1}>
              {patient.name}
            </Text>
            {(patient.ecg_count ?? 0) > 0 && (
              <View className="bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                <Text className="text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold">
                  {patient.ecg_count} ECG
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-0.5">{meta}</Text>
          {(patient.patient_id ?? patient.reference) != null && (
            <Text
              className="text-[10px] text-gray-400 dark:text-zinc-500"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {patient.patient_id ?? patient.reference}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function PatientsScreen() {
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { patients, loading, refetch } = usePatientList({ limit: 200, enabled: true });

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.patient_id ?? '').toLowerCase().includes(q) ||
      (p.reference ?? '').toLowerCase().includes(q),
    );
  }, [patients, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View className="flex-1 dark:bg-zinc-950" style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}>
      {/* Header */}
      <View style={{
        backgroundColor: joyful.stepBarBg,
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
        borderBottomWidth: 2, borderBottomColor: joyful.tabBarBorder,
      }}>
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xl font-bold dark:text-violet-200" style={{ color: joyful.primaryDark }}>
              Mes patients
            </Text>
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {loading ? '…' : `${filtered.length} patient${filtered.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ backgroundColor: joyful.primaryMuted, padding: 8, borderRadius: 10 }}
          >
            <Ionicons name="refresh" size={16} color={joyful.primary} />
          </TouchableOpacity>
        </View>

        {/* Barre de recherche */}
        <View className="flex-row items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 h-10 border border-transparent dark:border-zinc-700">
          <Text className="text-gray-400 dark:text-zinc-500 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-gray-800 dark:text-zinc-100"
            placeholder="Rechercher un patient, une référence…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text className="text-gray-400 text-lg leading-none">×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste */}
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
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 30 }}
          >
            {filtered.length === 0
              ? (
                <View className="items-center mt-16 px-6">
                  <Ionicons name="people-outline" size={48} color="#9ca3af" />
                  <Text className="text-gray-500 dark:text-zinc-400 font-medium text-center mt-3">
                    {search ? 'Aucun patient ne correspond à votre recherche.' : 'Aucun patient enregistré'}
                  </Text>
                </View>
              )
              : filtered.map(patient => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onPress={() =>
                    router.push({
                      pathname: '/(medecin)/patient-history',
                      params: { id: patient.id, name: patient.name },
                    })
                  }
                />
              ))
            }
          </ScrollView>
        )
      }
    </View>
  );
}
