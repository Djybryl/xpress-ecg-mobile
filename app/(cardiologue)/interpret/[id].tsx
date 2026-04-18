/**
 * Écran d'interprétation ECG — layout split-view :
 * - Haut : tracé ECG (signal parsé ou image) via ECGTraceView
 * - Bas  : formulaire non-linéaire (mesures + conclusion)
 * - Pied : barre d'actions (abandonner / valider)
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgRecordDetail } from '@/hooks/useEcgRecordDetail';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';
import { usePatientEcgHistory } from '@/hooks/usePatientEcgHistory';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { ECGTraceView } from '@/components/ecg/ECGTraceView';
import { useInterpretDraft } from '@/hooks/useInterpretDraft';
import { getAxisPresets, getRhythmPresets } from '@/constants/interpretPresets';
import { buildMeasurementsPayload } from '@/lib/interpretMeasurements';
import { useTranslation } from '@/i18n';

type FormTab = 'mesures' | 'conclusion';

const QUEUE_HREF = '/(cardiologue)/queue' as Href;

export default function InterpretEcgScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, locale } = useTranslation();

  const rhythmPresets = useMemo(() => getRhythmPresets(locale), [locale]);
  const axisPresets = useMemo(() => getAxisPresets(locale), [locale]);

  const { record, loading: recLoading, error: recError, refetch: refetchRecord } = useEcgRecordDetail(id);
  const { analysis: aiAnalysis, refetch: refetchAi } = useAiAnalysis(id);
  const navigation = useNavigation();
  const patientId = record?.patient_id ?? null;
  const { records: previousEcgs } = usePatientEcgHistory(patientId, id);
  const [expandedPrev, setExpandedPrev] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FormTab>('mesures');
  const [aiDismissed, setAiDismissed] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [rhythm, setRhythm] = useState('');
  const [axis, setAxis] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [prInterval, setPrInterval] = useState('');
  const [qrsDuration, setQrsDuration] = useState('');
  const [qtInterval, setQtInterval] = useState('');
  const [observations, setObservations] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [isNormal, setIsNormal] = useState(false);
  const [signConfirmed, setSignConfirmed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { restore: restoreDraft, save: saveDraft, discard: discardDraft } = useInterpretDraft(id);
  const didApplyRecordHr = useRef(false);

  useEffect(() => {
    setAiDismissed(false);
    setAiExpanded(false);
    didApplyRecordHr.current = false;
  }, [id]);

  useEffect(() => {
    if (draftRestored) return;
    restoreDraft().then(draft => {
      if (draft) {
        if (draft.rhythm) setRhythm(draft.rhythm);
        if (draft.axis) setAxis(draft.axis);
        if (draft.heartRate) setHeartRate(draft.heartRate);
        setPrInterval(draft.prInterval ?? '');
        setQrsDuration(draft.qrsDuration ?? '');
        setQtInterval(draft.qtInterval ?? '');
        setObservations(draft.observations ?? '');
        if (draft.conclusion) setConclusion(draft.conclusion);
        setSignConfirmed(draft.signConfirmed ?? true);
      }
      setDraftRestored(true);
    });
  }, [draftRestored, restoreDraft]);

  useEffect(() => {
    if (!draftRestored) return;
    saveDraft({
      rhythm,
      axis,
      heartRate,
      prInterval,
      qrsDuration,
      qtInterval,
      observations,
      conclusion,
      signConfirmed,
    });
  }, [
    draftRestored,
    rhythm,
    axis,
    heartRate,
    prInterval,
    qrsDuration,
    qtInterval,
    observations,
    conclusion,
    signConfirmed,
    saveDraft,
  ]);

  useEffect(() => {
    if (!draftRestored || !record || didApplyRecordHr.current) return;
    if (heartRate.trim() !== '') {
      didApplyRecordHr.current = true;
      return;
    }
    if (record.heart_rate != null && Number.isFinite(record.heart_rate)) {
      setHeartRate(String(Math.round(record.heart_rate)));
    }
    didApplyRecordHr.current = true;
  }, [draftRestored, record, heartRate]);

  const isAssignedToMe = record?.assigned_to === user?.id;
  const canStartAnalysis = record?.status === 'validated' && !record?.assigned_to;
  const isAnalyzing = record?.status === 'analyzing' && isAssignedToMe;
  const isAssigned = record?.status === 'assigned' && isAssignedToMe;
  const isReadOnly = !!record && !canStartAnalysis && !isAnalyzing && !isAssigned && !analysisStarted;

  const completionItems = useMemo(
    () => ({
      rhythm: !!rhythm.trim(),
      conclusion: conclusion.trim().length >= 10,
    }),
    [rhythm, conclusion],
  );

  const completionPct = useMemo(() => {
    const vals = Object.values(completionItems);
    return Math.round((vals.filter(Boolean).length / vals.length) * 100);
  }, [completionItems]);

  const canSubmit = completionItems.rhythm && completionItems.conclusion;

  const hasDraftContent = useMemo(() => {
    if (!record || isReadOnly) return false;
    return (
      !!rhythm.trim() ||
      !!axis.trim() ||
      !!heartRate.trim() ||
      !!prInterval.trim() ||
      !!qrsDuration.trim() ||
      !!qtInterval.trim() ||
      !!observations.trim() ||
      !!conclusion.trim() ||
      isNormal ||
      !signConfirmed
    );
  }, [record, isReadOnly, rhythm, axis, heartRate, prInterval, qrsDuration, qtInterval, observations, conclusion, isNormal, signConfirmed]);

  const onPreventRemove = useCallback(
    ({ data }: { data: { action: object } }) => {
      Alert.alert(t.interpret.leaveTitle, t.interpret.leaveMessage, [
        { text: t.interpret.stayOnScreen, style: 'cancel', onPress: () => {} },
        {
          text: t.interpret.leaveToQueue,
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action as never),
        },
      ]);
    },
    [navigation, t.interpret.leaveTitle, t.interpret.leaveMessage, t.interpret.stayOnScreen, t.interpret.leaveToQueue],
  );

  usePreventRemove(hasDraftContent && !submitting && !recLoading && !recError, onPreventRemove);

  const goToQueue = useCallback(() => {
    if (recLoading || recError || !record) {
      router.replace(QUEUE_HREF);
      return;
    }
    if (!isReadOnly && hasDraftContent && !submitting) {
      Alert.alert(t.interpret.leaveTitle, t.interpret.leaveMessage, [
        { text: t.interpret.stayOnScreen, style: 'cancel' },
        { text: t.interpret.leaveToQueue, onPress: () => router.replace(QUEUE_HREF) },
      ]);
      return;
    }
    router.replace(QUEUE_HREF);
  }, [
    recLoading,
    recError,
    record,
    isReadOnly,
    hasDraftContent,
    submitting,
    t.interpret.leaveTitle,
    t.interpret.leaveMessage,
    t.interpret.stayOnScreen,
    t.interpret.leaveToQueue,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchRecord(), refetchAi()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchRecord, refetchAi]);

  const rhythmMatches = useMemo(() => {
    const q = rhythm.trim().toLowerCase();
    if (q.length < 1) return [] as string[];
    return rhythmPresets.filter((o) => {
      const ol = o.toLowerCase();
      return ol.includes(q) && ol !== q;
    }).slice(0, 8);
  }, [rhythm, rhythmPresets]);

  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';

  const handleStartAnalysis = useCallback(async () => {
    if (!id) return;
    try {
      await api.post(`/ecg-records/${id}/start-analysis`);
      setAnalysisStarted(true);
    } catch (e) {
      Alert.alert(t.common.error, getApiErrorMessage(e));
    }
  }, [id, t.common.error]);

  const handleSubmit = useCallback(async () => {
    if (!id || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      const measurements = buildMeasurementsPayload(heartRate, prInterval, qrsDuration, qtInterval);
      await api.post(`/ecg-records/${id}/complete-analysis`, {
        interpretation: { rhythm, axis, observations, conclusion, isNormal },
        measurements,
        sign_confirmed: signConfirmed,
        signature_method: signConfirmed ? 'explicit_confirm' : undefined,
      });
      await discardDraft();
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* Haptique indisponible (ex. simulateur web). */
      }
      Alert.alert(t.interpret.success, t.interpret.successMessage, [
        { text: t.interpret.successDismiss, onPress: () => router.replace(QUEUE_HREF) },
      ]);
    } catch (e) {
      Alert.alert(t.common.error, getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    id,
    user?.id,
    submitting,
    rhythm,
    axis,
    observations,
    conclusion,
    isNormal,
    heartRate,
    prInterval,
    qrsDuration,
    qtInterval,
    signConfirmed,
    discardDraft,
    t.interpret.success,
    t.interpret.successMessage,
    t.interpret.successDismiss,
    t.common.error,
  ]);

  const handleAbandon = useCallback(() => {
    if (!id) return;
    Alert.alert(
      t.interpret.abandonTitle,
      t.interpret.abandonMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.interpret.abandonConfirm,
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/ecg-records/${id}/abandon`);
              router.replace(QUEUE_HREF);
            } catch (e) {
              Alert.alert(t.common.error, getApiErrorMessage(e));
            }
          },
        },
      ],
    );
  }, [id, t.interpret.abandonTitle, t.interpret.abandonMessage, t.common.cancel, t.interpret.abandonConfirm, t.common.error]);

  // ─── Loading / Error states ─────────────────────────────────────────────

  if (recLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <TouchableOpacity onPress={() => router.replace(QUEUE_HREF)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="chevron-back" size={22} color={joyful.primary} />
            <Text style={{ color: joyful.primary, fontWeight: '600', marginLeft: 4 }}>{t.common.back}</Text>
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
        <TouchableOpacity onPress={() => router.replace(QUEUE_HREF)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="chevron-back" size={22} color={joyful.primary} />
          <Text style={{ color: joyful.primary, fontWeight: '600', marginLeft: 4 }}>{t.common.back}</Text>
        </TouchableOpacity>
        <Text style={{ color: joyful.semantic.error, fontSize: 16, fontWeight: '600' }}>{t.interpret.notFoundTitle}</Text>
        <Text style={{ color: joyful.neutral.textMuted, marginTop: 8 }}>{recError ?? t.interpret.notFoundDetail}</Text>
      </View>
    );
  }

  const headerBg = record.urgency === 'urgent' ? '#b91c1c' : joyful.primaryDark;

  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 8 : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={{ flex: 1, backgroundColor: joyful.screenBg }}>
        {/* ─── Header compact ────────────────────────────────── */}
        <View
          style={{
            backgroundColor: headerBg,
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={goToQueue} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginLeft: 2, fontSize: 13 }}>{t.interpret.navQueue}</Text>
            </TouchableOpacity>
            <Text style={{ color: 'white', fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'center' }} numberOfLines={1}>
              {record.patient_name}{record.urgency === 'urgent' ? ' ⚡' : ''}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' }}>
              {record.reference}
            </Text>
          </View>
          {record.clinical_context ? (
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 4 }} numberOfLines={1}>
              {record.clinical_context}
            </Text>
          ) : null}
        </View>

        {/* ─── Tracé ECG ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
          <ECGTraceView
            ecgId={id!}
            files={record.files}
            height={240}
            recordHeartRate={record.heart_rate}
          />
        </View>

        {/* ─── Bandeau brouillon restauré ──────────────────────── */}
        {draftRestored && !isReadOnly && (rhythm || conclusion || observations.trim()) && completionPct < 100 && (
          <View className="mx-4 mt-1 flex-row items-center gap-1.5">
            <Ionicons name="save-outline" size={11} color="#6b7280" />
            <Text className="text-[10px] text-gray-500 dark:text-zinc-400">{t.interpret.draftRestored}</Text>
          </View>
        )}

        {/* ─── Indicateur de complétion ──────────────────────── */}
        {!isReadOnly && (
          <View className="px-4 py-2">
            <View className="flex-row items-center gap-2">
              <View className="flex-1 bg-gray-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                <View
                  className={completionPct === 100 ? 'bg-green-500' : 'bg-violet-500'}
                  style={{ width: `${completionPct}%`, height: '100%', borderRadius: 99 }}
                />
              </View>
              <Text className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold">
                {completionPct}%
              </Text>
              {completionItems.rhythm && <Ionicons name="pulse-outline" size={12} color="#16a34a" />}
              {completionItems.conclusion && <Ionicons name="document-text-outline" size={12} color="#16a34a" />}
            </View>
            <Text className="text-[9px] text-gray-400 dark:text-zinc-500 mt-1">{t.interpret.fcOptional}</Text>
          </View>
        )}

        {/* ─── Suggestion IA ─── */}
        {!isReadOnly && !aiDismissed && aiAnalysis?.pre_report_draft && aiAnalysis.status === 'completed' && (
          aiExpanded ? (
            <View className="mx-4 mb-2 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-700 rounded-2xl p-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center gap-1.5 flex-1 flex-wrap">
                  <Ionicons name="sparkles" size={14} color="#0284c7" />
                  <Text className="text-sky-800 dark:text-sky-200 text-xs font-bold">
                    {t.interpret.aiTitle}
                    {aiAnalysis.triage ? ` · ${aiAnalysis.triage}` : ''}
                  </Text>
                  {aiAnalysis.stub_mode ? (
                    <View className="bg-sky-200/90 dark:bg-sky-800 px-1.5 py-0.5 rounded-md">
                      <Text className="text-[9px] font-bold text-sky-900 dark:text-sky-100">{t.interpret.aiStubBadge}</Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-1">
                  <TouchableOpacity
                    onPress={() => setAiExpanded(false)}
                    hitSlop={8}
                    accessibilityLabel={t.interpret.aiCollapse}
                    accessibilityRole="button"
                  >
                    <Ionicons name="chevron-up" size={18} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setAiDismissed(true)} hitSlop={8} accessibilityLabel={t.interpret.dismissAiA11y}>
                    <Ionicons name="close" size={14} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text className="text-sky-900 dark:text-sky-100 text-xs leading-4 mb-2" numberOfLines={10}>
                {aiAnalysis.pre_report_draft}
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setConclusion(aiAnalysis.pre_report_draft!);
                    setActiveTab('conclusion');
                    setAiDismissed(true);
                  }}
                  className="flex-1 bg-sky-600 py-2 rounded-xl items-center"
                >
                  <Text className="text-white text-xs font-bold">{t.interpret.aiAccept}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setConclusion(aiAnalysis.pre_report_draft!);
                    setActiveTab('conclusion');
                  }}
                  className="flex-1 border border-sky-300 dark:border-sky-700 py-2 rounded-xl items-center"
                >
                  <Text className="text-sky-700 dark:text-sky-300 text-xs font-bold">{t.interpret.aiEdit}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setAiExpanded(true)}
              className="mx-4 mb-2 flex-row items-center justify-between bg-sky-50/90 dark:bg-sky-950/25 border border-sky-200/90 dark:border-sky-800 rounded-xl px-3 py-2.5"
              accessibilityRole="button"
              accessibilityLabel={`${t.interpret.aiTitle}. ${t.interpret.aiShow}`}
            >
              <View className="flex-row items-center gap-2 flex-1 pr-2">
                <Ionicons name="sparkles" size={14} color="#0284c7" />
                <Text className="text-sky-900 dark:text-sky-100 text-xs font-semibold flex-1" numberOfLines={2}>
                  {t.interpret.aiTitle}
                  {aiAnalysis.stub_mode ? ` · ${t.interpret.aiStubBadge}` : ''}
                  {aiAnalysis.triage ? ` — ${aiAnalysis.triage}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </TouchableOpacity>
          )
        )}

        {/* ─── Bandeau « Prendre en charge » si nécessaire ──── */}
        {canStartAnalysis && !analysisStarted && (
          <View className="mx-4 mb-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-700 rounded-2xl p-3">
            <Text className="text-indigo-800 dark:text-indigo-200 text-xs mb-2">
              {t.interpret.takeOverHint}
            </Text>
            <Text className="text-indigo-700/90 dark:text-indigo-300/90 text-[10px] mb-2 leading-4">
              {t.interpret.secondOpinionAfterTakeover}
            </Text>
            <TouchableOpacity
              onPress={handleStartAnalysis}
              className="bg-indigo-600 py-2.5 rounded-xl items-center"
              accessibilityLabel={t.interpret.takeOverA11y}
              accessibilityRole="button"
            >
              <Text className="text-white font-bold text-sm">{t.interpret.takeOver}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Bandeau lecture seule ─────────────────────────── */}
        {isReadOnly && (
          <View className="mx-4 mb-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl p-3">
            <Text className="text-amber-800 dark:text-amber-200 font-semibold text-xs">
              {record.status === 'completed'
                ? t.interpret.readOnlyCompleted
                : record.assigned_to && !isAssignedToMe
                  ? t.interpret.readOnlyTakenByOther
                  : t.interpret.readOnlyCannotEdit}
            </Text>
          </View>
        )}

        {/* ─── Onglets Mesures / Conclusion ──────────────────── */}
        {!isReadOnly && (
          <View className="flex-row mx-4 mt-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-0.5" accessibilityRole="tablist">
            {(['mesures', 'conclusion'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-white dark:bg-zinc-700 shadow-sm' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
                accessibilityLabel={tab === 'mesures' ? t.interpret.tabA11yMeasures : t.interpret.tabA11yConclusion}
              >
                <Text className={`text-xs font-semibold ${activeTab === tab ? 'text-violet-700 dark:text-violet-300' : 'text-gray-500 dark:text-zinc-400'}`}>
                  {tab === 'mesures' ? t.interpret.tabMeasures : t.interpret.tabConclusion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Formulaire scrollable ─────────────────────────── */}
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={joyful.primary}
              colors={[joyful.primary]}
              accessibilityLabel={t.interpret.pullToRefresh}
            />
          }
        >
          {/* TAB MESURES */}
          {(!isReadOnly && activeTab === 'mesures') && (
            <View>
              {/* Rythme */}
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-1.5" accessibilityRole="header">
                {t.interpret.rhythm}
              </Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 mb-2"
                placeholder={t.interpret.rhythmPlaceholder}
                placeholderTextColor="#9ca3af"
                value={rhythm}
                onChangeText={setRhythm}
                autoCorrect={false}
                autoCapitalize="sentences"
                accessibilityLabel={t.interpret.rhythm}
              />
              <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mb-1.5">{t.interpret.rhythmShortcuts}</Text>
              <View className="mb-4">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="max-h-10"
                  contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {rhythmPresets.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setRhythm(opt)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: rhythm === opt }}
                      accessibilityLabel={opt}
                      className={`px-3 py-1.5 rounded-full border ${
                        rhythm === opt
                          ? 'border-violet-500 bg-violet-600'
                          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${rhythm === opt ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}
                        numberOfLines={1}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {rhythmMatches.length > 0 ? (
                  <View className="mt-2">
                    <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mb-1">{t.interpret.rhythmMatches}</Text>
                    {rhythmMatches.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => setRhythm(opt)}
                        accessibilityRole="button"
                        accessibilityLabel={opt}
                        className="py-2 border-b border-gray-100 dark:border-zinc-800"
                      >
                        <Text className="text-sm text-violet-700 dark:text-violet-300 font-medium">{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Axe */}
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-2" accessibilityRole="header">
                {t.interpret.axisElectrical}
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {axisPresets.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setAxis(opt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: axis === opt }}
                    accessibilityLabel={opt}
                    className={`px-3 py-1.5 rounded-full border ${
                      axis === opt
                        ? 'border-violet-500 bg-violet-600'
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <Text className={`text-[11px] font-semibold ${axis === opt ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* FC */}
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-2" accessibilityRole="header">
                {t.interpret.heartRateBpm}
              </Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 mb-4"
                placeholder={t.interpret.fcPlaceholder}
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={heartRate}
                onChangeText={setHeartRate}
                accessibilityLabel={t.interpret.heartRate}
              />

              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-1" accessibilityRole="header">
                {t.interpret.intervalsTitle}{' '}
                <Text className="text-[10px] font-normal text-gray-500 dark:text-zinc-400">({t.interpret.intervalsUnit})</Text>
              </Text>
              <View className="flex-row gap-2 mb-4">
                <View className="flex-1">
                  <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mb-1">{t.interpret.prInterval}</Text>
                  <TextInput
                    className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
                    placeholder={t.interpret.emptyDash}
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={prInterval}
                    onChangeText={setPrInterval}
                    accessibilityLabel={`${t.interpret.prInterval} (${t.interpret.intervalsUnit})`}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mb-1">{t.interpret.qrsDuration}</Text>
                  <TextInput
                    className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
                    placeholder={t.interpret.emptyDash}
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={qrsDuration}
                    onChangeText={setQrsDuration}
                    accessibilityLabel={`${t.interpret.qrsDuration} (${t.interpret.intervalsUnit})`}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mb-1">{t.interpret.qtInterval}</Text>
                  <TextInput
                    className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
                    placeholder={t.interpret.emptyDash}
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={qtInterval}
                    onChangeText={setQtInterval}
                    accessibilityLabel={`${t.interpret.qtInterval} (${t.interpret.intervalsUnit})`}
                  />
                </View>
              </View>

              {/* Observations */}
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-2" accessibilityRole="header">
                {t.interpret.observations}
              </Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100"
                placeholder={t.interpret.observationsPlaceholder}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={observations}
                onChangeText={setObservations}
                style={{ minHeight: 70 }}
                accessibilityLabel={t.interpret.observations}
              />

              {/* Lien second avis */}
              {(isAnalyzing || isAssigned || analysisStarted) && (
                <TouchableOpacity
                  onPress={() => router.push(`/(cardiologue)/request-second-opinion?ecg_record_id=${id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={t.interpret.secondOpinion}
                  className="mt-4 flex-row items-center justify-center py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30"
                >
                  <Ionicons name="people-outline" size={16} color={joyful.primary} />
                  <Text className="ml-2 text-xs font-semibold" style={{ color: joyful.primary }}>
                    {t.interpret.secondOpinion}
                  </Text>
                </TouchableOpacity>
              )}

              {/* ECG antérieurs du patient */}
              {previousEcgs.length > 0 && (
                <View className="mt-5">
                  <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-2" accessibilityRole="header">
                    <Ionicons name="time-outline" size={13} color="#6b7280" /> {t.interpret.previousEcgs} ({previousEcgs.length})
                  </Text>
                  {previousEcgs.map(prev => (
                    <View
                      key={prev.id}
                      className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl mb-2 overflow-hidden border border-gray-100 dark:border-zinc-700"
                    >
                      <TouchableOpacity
                        className="px-3 py-2.5 flex-row items-center justify-between"
                        onPress={() => setExpandedPrev(p => p === prev.id ? null : prev.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={prev.reference}
                        accessibilityHint={t.queue.previewTrace}
                        accessibilityState={{ expanded: expandedPrev === prev.id }}
                      >
                        <View className="flex-1">
                          <Text className="text-xs font-semibold text-gray-800 dark:text-zinc-200">
                            {prev.reference}
                          </Text>
                          <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                            {new Date(prev.date).toLocaleDateString(dateLocale)} · {prev.medical_center}
                          </Text>
                        </View>
                        <Ionicons
                          name={expandedPrev === prev.id ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                      {expandedPrev === prev.id && (
                        <View className="px-2 pb-2">
                          <ECGTraceView ecgId={prev.id} height={130} compact />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB CONCLUSION */}
          {(!isReadOnly && activeTab === 'conclusion') && (
            <View>
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-2" accessibilityRole="header">
                {t.interpret.conclusionTitle}
              </Text>
              <TextInput
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-zinc-100 mb-1"
                placeholder={t.interpret.conclusionPlaceholder}
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={conclusion}
                onChangeText={setConclusion}
                style={{ minHeight: 120 }}
                accessibilityLabel={t.interpret.conclusionTitle}
              />
              <Text className="text-[10px] text-gray-400 dark:text-zinc-500 mb-3">
                {t.interpret.charCount.replace('{{count}}', String(conclusion.length))}{' '}
                {conclusion.trim().length < 10 ? t.interpret.minCharsHint : '✓'}
              </Text>

              {/* ECG normal */}
              <TouchableOpacity
                onPress={() => setIsNormal(v => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isNormal }}
                accessibilityLabel={t.interpret.ecgNormalFull}
                className={`flex-row items-center p-3 rounded-xl border mb-3 ${
                  isNormal
                    ? 'border-green-400 bg-green-50 dark:bg-green-950/30'
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                }`}
              >
                <Ionicons
                  name={isNormal ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isNormal ? '#16a34a' : '#9ca3af'}
                />
                <Text className={`ml-2 text-xs font-semibold ${isNormal ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-zinc-300'}`}>
                  {t.interpret.ecgNormalFull}
                </Text>
              </TouchableOpacity>

              {/* Signature */}
              <TouchableOpacity
                onPress={() => setSignConfirmed(v => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: signConfirmed }}
                accessibilityLabel={t.interpret.signatureConfirm}
                className={`flex-row items-start p-3 rounded-xl border ${
                  signConfirmed
                    ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/30'
                    : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
                }`}
              >
                <Ionicons
                  name={signConfirmed ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={signConfirmed ? joyful.primary : '#9ca3af'}
                />
                <Text className="ml-2 text-[11px] flex-1 text-gray-700 dark:text-zinc-300 leading-4">
                  {t.interpret.signatureConfirm}
                </Text>
              </TouchableOpacity>

              {/* Récapitulatif compact */}
              {canSubmit && (
                <View className="mt-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3">
                  <Text
                    className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-wide mb-2"
                    accessibilityRole="header"
                  >
                    {t.interpret.summaryTitle}
                  </Text>
                  {[
                    { label: t.interpret.rhythm, value: rhythm },
                    { label: t.interpret.axis, value: axis || t.interpret.emptyDash },
                    {
                      label: t.interpret.heartRateBpm,
                      value: heartRate ? `${heartRate} ${t.interpret.bpmUnit}` : t.interpret.emptyDash,
                    },
                    {
                      label: `${t.interpret.prInterval} (${t.interpret.intervalsUnit})`,
                      value: prInterval.trim() ? prInterval : t.interpret.emptyDash,
                    },
                    {
                      label: `${t.interpret.qrsDuration} (${t.interpret.intervalsUnit})`,
                      value: qrsDuration.trim() ? qrsDuration : t.interpret.emptyDash,
                    },
                    {
                      label: `${t.interpret.qtInterval} (${t.interpret.intervalsUnit})`,
                      value: qtInterval.trim() ? qtInterval : t.interpret.emptyDash,
                    },
                    { label: t.interpret.ecgNormalShort, value: isNormal ? t.common.yes : t.common.no },
                  ].map(row => (
                    <View key={row.label} className="flex-row mb-1">
                      <Text className="text-[10px] text-gray-400 dark:text-zinc-500 min-w-[5rem] max-w-[40%] pr-1">{row.label}</Text>
                      <Text className="text-[11px] text-gray-800 dark:text-zinc-200 font-medium flex-1">{row.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* MODE LECTURE SEULE — infos patient */}
          {isReadOnly && (
            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-sm mb-3" accessibilityRole="header">
                {t.interpret.patientInfoTitle}
              </Text>
              {[
                { label: t.interpret.labelPatient, value: record.patient_name },
                { label: t.interpret.labelReference, value: record.reference },
                { label: t.interpret.labelCenter, value: record.medical_center },
                {
                  label: t.interpret.labelUrgency,
                  value: record.urgency === 'urgent' ? `⚡ ${t.interpret.urgencyUrgent}` : t.interpret.urgencyNormal,
                },
                { label: t.interpret.labelContext, value: record.clinical_context || t.interpret.emptyDash },
              ].map(row => (
                <View key={row.label} className="flex-row mb-2">
                  <Text className="text-xs text-gray-500 dark:text-zinc-400 w-20">{row.label}</Text>
                  <Text className="text-xs text-gray-900 dark:text-zinc-100 flex-1 font-medium">{row.value}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ─── Barre d'actions fixe ──────────────────────────── */}
        <View
          className="bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 px-4 pt-2.5"
          style={{ paddingBottom: insets.bottom + 6 }}
        >
          {!isReadOnly && (
            <View className="flex-row gap-3">
              {(isAnalyzing || isAssigned || analysisStarted) && (
                <TouchableOpacity
                  onPress={handleAbandon}
                  className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 items-center justify-center"
                  accessibilityLabel={t.interpret.releaseA11y}
                  accessibilityRole="button"
                >
                  <Text className="text-red-600 dark:text-red-400 font-semibold text-xs">{t.interpret.release}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit || submitting}
                className={`flex-1 py-3 rounded-xl items-center ${canSubmit ? 'bg-violet-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                accessibilityLabel={
                  submitting ? t.interpret.submitting : canSubmit ? t.interpret.validate : t.interpret.completeMissing
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit || submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color="white" size="small" accessibilityLabel={t.interpret.submitting} />
                ) : (
                  <Text className={`font-bold text-sm ${canSubmit ? 'text-white' : 'text-gray-400 dark:text-zinc-500'}`}>
                    {t.interpret.validate}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {!isReadOnly && !canSubmit && !submitting && (
            <Text className="text-center text-[10px] text-gray-500 dark:text-zinc-400 mt-2 px-2">
              {t.interpret.validationHint}
            </Text>
          )}
          {isReadOnly && (
            <TouchableOpacity
              onPress={goToQueue}
              className="py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 items-center"
            >
              <Text className="text-gray-700 dark:text-zinc-300 font-semibold text-sm">{t.interpret.backToQueueList}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
