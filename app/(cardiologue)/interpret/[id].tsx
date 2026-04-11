import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgRecordDetail } from '@/hooks/useEcgRecordDetail';
import { api, getApiErrorMessage } from '@/lib/apiClient';

type AnalysisStep = 'info' | 'interpretation' | 'conclusion' | 'confirm';

const RHYTHM_OPTIONS = [
  'Rythme sinusal', 'Fibrillation auriculaire', 'Flutter auriculaire',
  'Tachycardie ventriculaire', 'Bradycardie sinusale', 'Bloc auriculo-ventriculaire',
  'Extrasystoles ventriculaires', 'Bloc de branche droit', 'Bloc de branche gauche',
  'Autre',
];

const AXIS_OPTIONS = ['Normal', 'Dévié à gauche', 'Dévié à droite', 'Indéterminé'];

export default function InterpretEcgScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  const { record, loading: recLoading, error: recError } = useEcgRecordDetail(id);

  const [step, setStep] = useState<AnalysisStep>('info');
  const [rhythm, setRhythm] = useState('');
  const [axis, setAxis] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [observations, setObservations] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [isNormal, setIsNormal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canProceed = useCallback(() => {
    switch (step) {
      case 'info':     return !!record;
      case 'interpretation': return !!rhythm;
      case 'conclusion':     return conclusion.trim().length >= 10;
      default: return true;
    }
  }, [step, record, rhythm, conclusion]);

  const handleStartOrProceed = useCallback(async () => {
    if (!id || !user?.id) return;

    if (step === 'info' && record?.status === 'validated') {
      try {
        await api.post(`/ecg-records/${id}/start-analysis`);
      } catch (e) {
        Alert.alert('Erreur', getApiErrorMessage(e));
        return;
      }
    }

    if (step === 'info') { setStep('interpretation'); return; }
    if (step === 'interpretation') { setStep('conclusion'); return; }
    if (step === 'conclusion') { setStep('confirm'); return; }

    if (step === 'confirm') {
      setSubmitting(true);
      try {
        await api.post(`/ecg-records/${id}/complete-analysis`, {
          interpretation: {
            rhythm,
            axis,
            observations,
            conclusion,
            isNormal,
          },
          measurements: heartRate ? { heartRate: parseInt(heartRate, 10) } : {},
        });
        Alert.alert('Analyse envoyée', 'L\'interprétation a été soumise avec succès.', [
          { text: 'OK', onPress: () => router.replace('/(cardiologue)/queue' as Href) },
        ]);
      } catch (e) {
        Alert.alert('Erreur', getApiErrorMessage(e));
      } finally {
        setSubmitting(false);
      }
    }
  }, [step, id, user?.id, record, rhythm, axis, heartRate, observations, conclusion, isNormal]);

  const handleAbandon = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Abandonner l\'analyse',
      'L\'ECG sera remis dans la file commune pour un autre cardiologue.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/ecg-records/${id}/abandon`);
              router.replace('/(cardiologue)/queue' as Href);
            } catch (e) {
              Alert.alert('Erreur', getApiErrorMessage(e));
            }
          },
        },
      ],
    );
  }, [id]);

  const headerBg = record?.urgency === 'urgent' ? '#b91c1c' : joyful.primaryDark;

  if (recLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="chevron-back" size={22} color={joyful.primary} />
            <Text style={{ color: joyful.primary, fontWeight: '600', marginLeft: 4 }}>Retour</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={joyful.primary} size="large" />
        </View>
      </View>
    );
  }

  if (recError || !record) {
    return (
      <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top, padding: 24 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="chevron-back" size={22} color={joyful.primary} />
          <Text style={{ color: joyful.primary, fontWeight: '600', marginLeft: 4 }}>Retour</Text>
        </TouchableOpacity>
        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Dossier introuvable</Text>
        <Text style={{ color: '#9ca3af', marginTop: 8 }}>{recError ?? 'Impossible de charger ce dossier.'}</Text>
      </View>
    );
  }

  const isAssignedToMe = record.assigned_to === user?.id;
  const canStartAnalysis = record.status === 'validated' && !record.assigned_to;
  const isAnalyzing = record.status === 'analyzing' && isAssignedToMe;
  const isAssigned = record.status === 'assigned' && isAssignedToMe;
  const isReadOnly = !canStartAnalysis && !isAnalyzing && !isAssigned;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, backgroundColor: joyful.screenBg }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: headerBg,
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 20,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginLeft: 4 }}>File ECG</Text>
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
            {record.patient_name}
            {record.urgency === 'urgent' ? ' ⚡' : ''}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>
            {record.reference} · {record.medical_center}
          </Text>
          {record.clinical_context ? (
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 }} numberOfLines={3}>
              {record.clinical_context}
            </Text>
          ) : null}
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 32 }}
        >
          {/* Readonly info */}
          {isReadOnly && (
            <View className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 mb-4">
              <Text className="text-amber-800 dark:text-amber-200 font-semibold text-sm">
                {record.status === 'completed'
                  ? 'Ce dossier est déjà analysé.'
                  : record.assigned_to && !isAssignedToMe
                    ? 'Ce dossier est pris par un autre cardiologue.'
                    : 'Vous ne pouvez pas modifier ce dossier.'}
              </Text>
            </View>
          )}

          {/* STEP INFO */}
          {step === 'info' && !isReadOnly && (
            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-4">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-1">
                {canStartAnalysis ? 'Prendre en charge cet ECG' : 'Continuer l\'interprétation'}
              </Text>
              <Text className="text-gray-500 dark:text-zinc-400 text-sm mb-4">
                {canStartAnalysis
                  ? 'En commençant, vous serez assigné à ce dossier et il sera retiré de la file commune.'
                  : 'Ce dossier vous est assigné. Renseignez l\'interprétation pour le valider.'}
              </Text>
              <View className="flex-row gap-2 flex-wrap mb-2">
                {[
                  { label: `Âge : ${record.patient_age ?? '?'} ans` },
                  { label: `Genre : ${record.gender === 'M' ? 'Masculin' : record.gender === 'F' ? 'Féminin' : '?'}` },
                  { label: `Urgence : ${record.urgency === 'urgent' ? '⚡ Urgent' : 'Normal'}` },
                ].map(item => (
                  <View key={item.label} className="bg-gray-100 dark:bg-zinc-800 rounded-full px-3 py-1">
                    <Text className="text-xs text-gray-700 dark:text-zinc-300">{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* STEP INTERPRETATION */}
          {step === 'interpretation' && (
            <View className="mb-4">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-3">Rythme cardiaque</Text>
              {RHYTHM_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setRhythm(opt)}
                  className={`flex-row items-center mb-2 px-4 py-3 rounded-xl border ${
                    rhythm === opt ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <Ionicons
                    name={rhythm === opt ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={rhythm === opt ? joyful.primary : '#9ca3af'}
                  />
                  <Text className={`ml-3 text-sm ${rhythm === opt ? 'text-violet-700 dark:text-violet-300 font-semibold' : 'text-gray-700 dark:text-zinc-300'}`}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-3 mt-4">Axe électrique</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {AXIS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setAxis(opt)}
                    className={`px-4 py-2 rounded-full border ${
                      axis === opt ? 'border-violet-500 bg-violet-600' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${axis === opt ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-2">Fréquence cardiaque (bpm)</Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-zinc-100 mb-4"
                placeholder="ex. 72"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={heartRate}
                onChangeText={setHeartRate}
              />

              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-2">Observations complémentaires</Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-zinc-100"
                placeholder="Anomalies ST, ondes T, etc."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={observations}
                onChangeText={setObservations}
                style={{ minHeight: 90 }}
              />
            </View>
          )}

          {/* STEP CONCLUSION */}
          {step === 'conclusion' && (
            <View className="mb-4">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-2">Conclusion et recommandations</Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-zinc-100 mb-4"
                placeholder="Rédigez votre conclusion diagnostique et les recommandations pour le médecin prescripteur…"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                value={conclusion}
                onChangeText={setConclusion}
                style={{ minHeight: 160 }}
              />
              <Text className="text-xs text-gray-400 dark:text-zinc-500 mb-4">{conclusion.length} caractères</Text>

              <TouchableOpacity
                onPress={() => setIsNormal(v => !v)}
                className={`flex-row items-center p-4 rounded-2xl border ${
                  isNormal ? 'border-green-400 bg-green-50 dark:bg-green-950/30' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                }`}
              >
                <Ionicons
                  name={isNormal ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isNormal ? '#16a34a' : '#9ca3af'}
                />
                <Text className={`ml-3 text-sm font-semibold ${isNormal ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-zinc-300'}`}>
                  ECG dans les limites de la normale
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP CONFIRM */}
          {step === 'confirm' && (
            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-4">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-lg mb-4">Récapitulatif</Text>
              {[
                { label: 'Patient', value: record.patient_name },
                { label: 'Référence', value: record.reference },
                { label: 'Rythme', value: rhythm },
                { label: 'Axe', value: axis || 'Non précisé' },
                { label: 'FC', value: heartRate ? `${heartRate} bpm` : 'Non précisé' },
                { label: 'ECG normal', value: isNormal ? 'Oui' : 'Non' },
              ].map(row => (
                <View key={row.label} className="flex-row items-start mb-3">
                  <Text className="text-xs text-gray-500 dark:text-zinc-400 w-24 pt-0.5">{row.label}</Text>
                  <Text className="text-sm text-gray-900 dark:text-zinc-100 flex-1 font-medium">{row.value}</Text>
                </View>
              ))}
              <View className="border-t border-gray-100 dark:border-zinc-800 mt-1 pt-3">
                <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-1">Conclusion</Text>
                <Text className="text-sm text-gray-900 dark:text-zinc-100">{conclusion}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View
          className="bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {!isReadOnly && (
            <View className="flex-row gap-3">
              {(step === 'interpretation' || step === 'conclusion' || step === 'confirm') && (
                <TouchableOpacity
                  onPress={() => {
                    if (step === 'interpretation') setStep('info');
                    if (step === 'conclusion') setStep('interpretation');
                    if (step === 'confirm') setStep('conclusion');
                  }}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-zinc-700 items-center"
                >
                  <Text className="text-gray-700 dark:text-zinc-300 font-semibold">Retour</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleStartOrProceed}
                disabled={!canProceed() || submitting}
                className={`flex-1 py-3 rounded-2xl items-center ${canProceed() ? 'bg-violet-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className={`font-bold text-sm ${canProceed() ? 'text-white' : 'text-gray-400'}`}>
                    {step === 'info' ? (canStartAnalysis ? 'Prendre en charge' : 'Démarrer') :
                     step === 'interpretation' ? 'Suivant' :
                     step === 'conclusion' ? 'Prévisualiser' :
                     'Soumettre l\'analyse'}
                  </Text>
                )}
              </TouchableOpacity>
              {(step === 'info' || step === 'interpretation') && (isAnalyzing || isAssigned) && (
                <TouchableOpacity
                  onPress={handleAbandon}
                  className="px-4 py-3 rounded-2xl border border-red-200 dark:border-red-800 items-center"
                >
                  <Text className="text-red-600 dark:text-red-400 font-semibold text-sm">Libérer</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {isReadOnly && (
            <TouchableOpacity
              onPress={() => router.back()}
              className="py-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 items-center"
            >
              <Text className="text-gray-700 dark:text-zinc-300 font-semibold">Retour à la file</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
