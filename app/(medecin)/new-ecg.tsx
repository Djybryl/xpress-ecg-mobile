import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Platform, Modal,
  KeyboardAvoidingView, Animated, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { usePatientList, type PatientItem } from '@/hooks/usePatientList';
import { api, ApiError, getApiErrorMessage, getApiErrorAction, type UploadOptions } from '@/lib/apiClient';
import ECGImageCapture, { type ECGCaptureMultiResult } from '@/components/ECGImageCapture';
import { useTheme } from '@/providers/ThemeProvider';

// ─── Constantes ──────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Patient', 'ECG', 'Contexte', 'Envoi'];

const CLINICAL_TEMPLATES = [
  { id: 'chest', label: 'Douleur thoracique',  icon: 'heart-outline' as const,   text: 'Patient présentant une douleur thoracique.' },
  { id: 'palp',  label: 'Palpitations',        icon: 'pulse-outline' as const,   text: 'Patient se plaignant de palpitations.' },
  { id: 'dysp',  label: 'Dyspnée',             icon: 'fitness-outline' as const, text: 'Patient présentant une dyspnée.' },
  { id: 'sync',  label: 'Syncope',             icon: 'warning-outline' as const, text: 'Patient ayant présenté un malaise/syncope.' },
  { id: 'check', label: 'Bilan systématique',  icon: 'checkbox-outline' as const,text: 'ECG réalisé dans le cadre d\'un bilan systématique.' },
  { id: 'preop', label: 'Pré-opératoire',      icon: 'cut-outline' as const,     text: 'ECG pré-opératoire.' },
  { id: 'follow',label: 'Suivi',               icon: 'refresh-outline' as const, text: 'ECG de contrôle/suivi.' },
];

// ─── Composants UI ────────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: Step }) {
  const { colors: joyful } = useTheme();
  const done = step < current;
  const active = step === current;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: done ? joyful.stepDone : active ? joyful.stepActive : joyful.stepInactiveBg,
        borderWidth: active ? 0 : 1.5,
        borderColor: active ? 'transparent' : joyful.stepTrack,
      }}>
        {done
          ? <Ionicons name="checkmark" size={17} color="white" />
          : (
            <Text style={{
              fontSize: 13, fontWeight: '800',
              color: active ? 'white' : joyful.stepInactiveText,
            }}>{step}</Text>
          )
        }
      </View>
    </View>
  );
}

function StepBar({ current }: { current: Step }) {
  const { colors: joyful } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
      backgroundColor: joyful.stepBarBg, borderBottomWidth: 2, borderBottomColor: joyful.tabBarBorder,
    }}>
      {[1, 2, 3, 4].map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <StepIndicator step={s} current={current} />
            <Text style={{
              fontSize: 9, marginTop: 4, fontWeight: s === current ? '800' : '600',
              color: s === current ? joyful.primaryDark : joyful.tabRequests,
            }}>
              {STEP_LABELS[i]}
            </Text>
          </View>
          {i < 3 && (
            <View style={{
              flex: 1, height: 3, marginHorizontal: 2, marginBottom: 16, borderRadius: 2,
              backgroundColor: s < current ? joyful.stepDone : joyful.stepTrack,
            }} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── DateInput amélioré avec masque automatique ──────────────────────────────

function DateInput({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const { colors: joyful } = useTheme();
  const n = joyful.neutral;
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '-' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
    onChangeText(formatted);
  };

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
  const showError = value.length >= 10 && !isValid;

  return (
    <View>
      <View style={{
        flexDirection: 'row', alignItems: 'center', borderWidth: 1,
        borderColor: showError ? '#ef4444' : n.border,
        borderRadius: 12, paddingHorizontal: 12, height: 44, backgroundColor: n.inputBg,
      }}>
        <Ionicons name="calendar-outline" size={18} color={showError ? '#ef4444' : n.placeholder} style={{ marginRight: 8 }} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: n.text }}
          placeholder="1980-01-15"
          placeholderTextColor={n.placeholder}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>
      {showError && (
        <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 4 }}>
          Date invalide
        </Text>
      )}
    </View>
  );
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const { colors } = useTheme();
  const n = colors.neutral;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [percent, widthAnim]);

  return (
    <View style={{ height: 6, backgroundColor: n.progressTrack, borderRadius: 3, overflow: 'hidden' }}>
      <Animated.View style={{
        height: 6, borderRadius: 3, backgroundColor: n.progressFill,
        width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
}

// ─── État unifié du fichier ECG ───────────────────────────────────────────────

type EcgFileState =
  | { kind: 'image'; capture: ECGCaptureMultiResult }
  | { kind: 'document'; uri: string; name: string; mimeType: string }
  | null;

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function NewEcgScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const n = joyful.neutral;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  // Step animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const animateStep = (next: Step) => {
    const dir = next > step ? 1 : -1;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: dir * 40, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  // Données patient
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientDob, setNewPatientDob] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'M' | 'F' | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fichier ECG
  const [ecgFile, setEcgFile] = useState<EcgFileState>(null);

  // Contexte clinique
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState('');

  const { patients, loading: patientsLoading } = usePatientList({
    limit: 200,
    enabled: !!user?.id,
  });

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ── Contexte clinique combiné ───────────────────────────────────────────

  const buildClinicalContext = (): string => {
    const templateTexts = CLINICAL_TEMPLATES
      .filter(t => selectedTemplates.has(t.id))
      .map(t => t.text);
    const parts = [...templateTexts];
    if (freeText.trim()) parts.push(freeText.trim());
    return parts.join(' ');
  };

  // ── Toggle template ─────────────────────────────────────────────────────

  const toggleTemplate = useCallback((id: string) => {
    setSelectedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── PDF / DCM ───────────────────────────────────────────────────────────

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/dicom', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setEcgFile({ kind: 'document', uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
    }
  }, []);

  // ── Soumission ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!ecgFile || !user) return;

    // Confirmation pour les urgences
    if (urgency === 'urgent') {
      const confirmed = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Confirmer l\'urgence',
          'Cet ECG sera traité en priorité par le cardiologue. Confirmez-vous le caractère urgent ?',
          [
            { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirmer urgent', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmed) return;
    }

    setSubmitting(true);
    setUploadPercent(0);

    try {
      const patientName = isNewPatient
        ? newPatientName.trim()
        : (selectedPatient?.name ?? '');

      // Première page (fichier principal)
      const formData = new FormData();

      // F1 : champs snake_case alignés avec le backend
      if (selectedPatient && !isNewPatient) {
        formData.append('patient_id', selectedPatient.id);
      }
      formData.append('patient_name', patientName);
      if (isNewPatient && newPatientDob.trim()) {
        formData.append('date_of_birth', newPatientDob.trim());
      }
      if (isNewPatient && newPatientGender) {
        formData.append('gender', newPatientGender);
      }
      if (!isNewPatient && selectedPatient?.gender) {
        formData.append('gender', selectedPatient.gender);
      }

      // Obligatoire côté DB / aligné avec le web (NewECG.tsx)
      formData.append('medical_center', 'Cabinet médical');
      if (user.hospitalId) {
        formData.append('hospital_id', user.hospitalId);
      }

      formData.append('urgency', urgency);
      formData.append('clinical_context', buildClinicalContext());
      formData.append('date', new Date().toISOString().slice(0, 10));

      if (ecgFile.kind === 'image' && ecgFile.capture.pages.length > 0) {
        const firstPage = ecgFile.capture.pages[0];
        formData.append('file', {
          uri: firstPage.uri,
          name: firstPage.fileName,
          type: 'image/jpeg',
        } as unknown as Blob);
      } else if (ecgFile.kind === 'document') {
        formData.append('file', {
          uri: ecgFile.uri,
          name: ecgFile.name,
          type: ecgFile.mimeType,
        } as unknown as Blob);
      }

      const uploadOpts: UploadOptions = {
        onProgress: (p) => setUploadPercent(p),
      };

      const created = await api.upload<{ id: string }>('/ecg-records', formData, uploadOpts);

      // Pages supplémentaires (multi-page)
      if (ecgFile.kind === 'image' && ecgFile.capture.pages.length > 1 && created?.id) {
        for (let i = 1; i < ecgFile.capture.pages.length; i++) {
          const page = ecgFile.capture.pages[i];
          const extraForm = new FormData();
          extraForm.append('file', {
            uri: page.uri,
            name: page.fileName,
            type: 'image/jpeg',
          } as unknown as Blob);
          await api.upload(`/ecg-records/${created.id}/files`, extraForm);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Demande envoyée',
        'Votre demande ECG a été transmise avec succès.\nVous serez notifié dès qu\'un rapport sera disponible.',
        [{ text: 'OK', onPress: () => { resetForm(); router.push('/(medecin)/requests'); } }],
      );
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = getApiErrorMessage(e);
      const action = getApiErrorAction(e);

      const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' }[] = [
        { text: 'Fermer', style: 'cancel' },
      ];

      if (action === 'retry') {
        buttons.push({ text: 'Réessayer', onPress: () => handleSubmit() });
      } else if (action === 'login') {
        buttons.push({ text: 'Se reconnecter', onPress: () => router.replace('/(auth)/login') });
      }

      Alert.alert(
        e instanceof ApiError && e.code === 'QUOTA_EXCEEDED' ? 'Quota atteint' : 'Erreur d\'envoi',
        msg,
        buttons,
      );
    } finally {
      setSubmitting(false);
    }
  }, [ecgFile, user, selectedPatient, isNewPatient, newPatientName, newPatientDob, newPatientGender, urgency, selectedTemplates, freeText]);

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedPatient(null);
    setIsNewPatient(false);
    setNewPatientName('');
    setNewPatientDob('');
    setNewPatientGender('');
    setSearchQuery('');
    setEcgFile(null);
    setUrgency('normal');
    setSelectedTemplates(new Set());
    setFreeText('');
    setUploadPercent(0);
  }, []);

  const canGoNext = (): boolean => {
    if (step === 1) {
      if (isNewPatient) return newPatientName.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(newPatientDob) && !!newPatientGender;
      return selectedPatient !== null;
    }
    if (step === 2) return ecgFile !== null;
    if (step === 3) return true;
    return true;
  };

  const nextStep = async () => {
    if (!canGoNext()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateStep((step < 4 ? step + 1 : step) as Step);
  };

  const prevStep = () => {
    if (step > 1) animateStep((step - 1) as Step);
  };

  // ── Données récapitulatif ───────────────────────────────────────────────

  const patientDisplayName = isNewPatient ? newPatientName : selectedPatient?.name ?? '—';
  const fileDisplayName = ecgFile
    ? ecgFile.kind === 'image'
      ? `${ecgFile.capture.pages.length} page${ecgFile.capture.pages.length > 1 ? 's' : ''} image`
      : ecgFile.name
    : '—';

  const recapRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 14,
    gap: 12,
  };
  const recapIconStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: n.recapIconBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const recapLabelStyle = { fontSize: 11, color: n.textMuted, marginBottom: 2 };
  const recapValueStyle = { fontSize: 14, fontWeight: '600' as const, color: n.text };
  const recapSubStyle = { fontSize: 11, color: n.placeholder, marginTop: 1 };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{
        backgroundColor: joyful.stepBarBg, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
        borderBottomWidth: 2, borderBottomColor: joyful.captureCardBorder,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{
          width: 40, height: 40, borderRadius: 14, backgroundColor: joyful.primaryMuted,
          alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: joyful.primaryLight,
        }}>
          <Ionicons name="pulse" size={22} color={joyful.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: joyful.primaryDark }}>Nouvelle demande ECG</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: joyful.tabReports, marginTop: 2 }}>En quelques étapes seulement</Text>
        </View>
      </View>

      <StepBar current={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          >
            {/* ── ÉTAPE 1 : PATIENT ──────────────────────────────────────── */}
            {step === 1 && (
              <View style={{ gap: 12 }}>
                <View style={{
                  flexDirection: 'row', backgroundColor: n.toggleBg, borderRadius: 12, padding: 3,
                }}>
                  {[false, true].map(isNew => (
                    <TouchableOpacity
                      key={String(isNew)}
                      style={{
                        flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                        backgroundColor: isNewPatient === isNew ? n.surface : 'transparent',
                        ...(isNewPatient === isNew ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 } : {}),
                      }}
                      onPress={() => setIsNewPatient(isNew)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons
                          name={isNew ? 'person-add-outline' : 'people-outline'}
                          size={16}
                          color={isNewPatient === isNew ? n.text : n.placeholder}
                        />
                        <Text style={{
                          fontSize: 13, fontWeight: '500',
                          color: isNewPatient === isNew ? n.text : n.placeholder,
                        }}>
                          {isNew ? 'Nouveau' : 'Existant'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {!isNewPatient ? (
                  <>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', backgroundColor: n.surface,
                      borderWidth: 1, borderColor: n.border, borderRadius: 12, paddingHorizontal: 12, height: 44,
                    }}>
                      <Ionicons name="search-outline" size={18} color={n.placeholder} style={{ marginRight: 8 }} />
                      <TextInput
                        style={{ flex: 1, fontSize: 14, color: n.text }}
                        placeholder="Rechercher un patient…"
                        placeholderTextColor={n.placeholder}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                          <Ionicons name="close-circle" size={18} color={n.iconClose} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {patientsLoading
                      ? <ActivityIndicator color={n.progressFill} style={{ marginVertical: 32 }} />
                      : (
                        <View style={{
                          backgroundColor: n.surface, borderRadius: 16, overflow: 'hidden',
                          borderWidth: 1, borderColor: n.listBorder,
                        }}>
                          {filteredPatients.slice(0, 30).map((patient, index) => (
                            <View key={patient.id}>
                              {index > 0 && <View style={{ height: 1, backgroundColor: n.divider, marginHorizontal: 16 }} />}
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                                  backgroundColor: selectedPatient?.id === patient.id ? n.patientSelectedBg : 'transparent',
                                }}
                                onPress={() => { setSelectedPatient(patient); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                activeOpacity={0.7}
                              >
                                <View style={{
                                  width: 38, height: 38, borderRadius: 19,
                                  backgroundColor: selectedPatient?.id === patient.id ? joyful.primary : n.patientAvatarIdle,
                                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                }}>
                                  <Text style={{
                                    fontSize: 12, fontWeight: '700',
                                    color: selectedPatient?.id === patient.id ? 'white' : joyful.primary,
                                  }}>
                                    {patient.name.slice(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 14, fontWeight: '500', color: n.text }}>{patient.name}</Text>
                                  {patient.date_of_birth && (
                                    <Text style={{ fontSize: 11, color: n.textMuted, marginTop: 1 }}>{patient.date_of_birth}</Text>
                                  )}
                                </View>
                                {selectedPatient?.id === patient.id && (
                                  <Ionicons name="checkmark-circle" size={22} color={joyful.primary} />
                                )}
                              </TouchableOpacity>
                            </View>
                          ))}
                          {filteredPatients.length === 0 && (
                            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                              <Ionicons name="person-outline" size={32} color={n.iconClose} />
                              <Text style={{ color: n.placeholder, fontSize: 13, marginTop: 8 }}>Aucun patient trouvé</Text>
                            </View>
                          )}
                        </View>
                      )
                    }
                  </>
                ) : (
                  <View style={{
                    backgroundColor: n.surface, borderRadius: 16, padding: 16,
                    borderWidth: 1, borderColor: n.listBorder, gap: 14,
                  }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: n.textSecondary }}>Informations du patient</Text>

                    <View>
                      <Text style={{ fontSize: 11, color: n.textMuted, marginBottom: 4 }}>Nom complet *</Text>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', borderWidth: 1,
                        borderColor: n.border, borderRadius: 12, paddingHorizontal: 12, height: 44, backgroundColor: n.inputBg,
                      }}>
                        <Ionicons name="person-outline" size={18} color={n.placeholder} style={{ marginRight: 8 }} />
                        <TextInput
                          style={{ flex: 1, fontSize: 14, color: n.text }}
                          placeholder="Nom Prénom"
                          placeholderTextColor={n.placeholder}
                          value={newPatientName}
                          onChangeText={setNewPatientName}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, color: n.textMuted, marginBottom: 4 }}>Date de naissance *</Text>
                      <DateInput value={newPatientDob} onChangeText={setNewPatientDob} />
                    </View>

                    <View>
                      <Text style={{ fontSize: 11, color: n.textMuted, marginBottom: 6 }}>Sexe *</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {(['M', 'F'] as const).map(g => (
                          <TouchableOpacity
                            key={g}
                            style={{
                              flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                              flexDirection: 'row', justifyContent: 'center', gap: 6,
                              borderWidth: 1,
                              backgroundColor: newPatientGender === g ? joyful.primary : n.surface,
                              borderColor: newPatientGender === g ? joyful.primary : n.border,
                            }}
                            onPress={() => setNewPatientGender(g)}
                          >
                            <Ionicons
                              name={g === 'M' ? 'male' : 'female'}
                              size={18}
                              color={newPatientGender === g ? 'white' : n.textMuted}
                            />
                            <Text style={{
                              fontSize: 13, fontWeight: '500',
                              color: newPatientGender === g ? 'white' : n.textMuted,
                            }}>
                              {g === 'M' ? 'Masculin' : 'Féminin'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── ÉTAPE 2 : FICHIER ECG ───────────────────────────────────── */}
            {step === 2 && (
              <View style={{ gap: 12 }}>
                <ECGImageCapture
                  value={ecgFile?.kind === 'image' ? ecgFile.capture : null}
                  onCapture={capture => setEcgFile({ kind: 'image', capture })}
                  onClear={() => setEcgFile(null)}
                  documentSlot={
                    ecgFile?.kind !== 'image'
                      ? (
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            borderRadius: 16,
                            borderWidth: 2,
                            borderColor: joyful.documentBorder,
                            backgroundColor: ecgFile?.kind === 'document' ? joyful.documentBgActive : joyful.documentBg,
                            paddingVertical: 12,
                            paddingHorizontal: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            minHeight: 88,
                          }}
                          onPress={pickDocument}
                          activeOpacity={0.85}
                        >
                          <Ionicons
                            name="document-text"
                            size={24}
                            color={joyful.documentIcon}
                          />
                          {ecgFile?.kind === 'document' ? (
                            <>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: joyful.documentText, textAlign: 'center' }} numberOfLines={2}>
                                {ecgFile.name}
                              </Text>
                              <Text style={{ fontSize: 9, fontWeight: '600', color: joyful.documentIcon }}>Changer</Text>
                              <TouchableOpacity
                                onPress={() => setEcgFile(null)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ position: 'absolute', top: 6, right: 6 }}
                              >
                                <Ionicons name="close-circle" size={20} color={joyful.documentIcon} />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: joyful.documentText }}>PDF / DICOM</Text>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: joyful.documentIcon }}>Fichier</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )
                      : null
                  }
                />
              </View>
            )}

            {/* ── ÉTAPE 3 : CONTEXTE CLINIQUE ─────────────────────────────── */}
            {step === 3 && (
              <View style={{ gap: 16 }}>
                {/* Urgence */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: n.textSecondary, marginBottom: 8 }}>Niveau d'urgence</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['normal', 'urgent'] as const).map(u => (
                      <TouchableOpacity
                        key={u}
                        style={{
                          flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                          flexDirection: 'row', justifyContent: 'center', gap: 8,
                          borderWidth: 1,
                          backgroundColor: urgency === u
                            ? u === 'urgent' ? '#ef4444' : joyful.primary
                            : n.surface,
                          borderColor: urgency === u
                            ? u === 'urgent' ? '#ef4444' : joyful.primary
                            : n.border,
                        }}
                        onPress={() => { setUrgency(u); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      >
                        <Ionicons
                          name={u === 'urgent' ? 'flash' : 'time-outline'}
                          size={18}
                          color={urgency === u ? 'white' : n.textMuted}
                        />
                        <Text style={{
                          fontSize: 13, fontWeight: '600',
                          color: urgency === u ? 'white' : n.textMuted,
                        }}>
                          {u === 'urgent' ? 'Urgent' : 'Normal'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Templates (toggle chips) */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: n.textSecondary, marginBottom: 8 }}>Contexte clinique</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {CLINICAL_TEMPLATES.map(t => {
                      const active = selectedTemplates.has(t.id);
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                            borderWidth: 1,
                            backgroundColor: active ? n.chipActiveBg : n.chipInactiveBg,
                            borderColor: active ? n.chipActiveBorder : n.border,
                          }}
                          onPress={() => toggleTemplate(t.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={t.icon} size={14} color={active ? joyful.primary : n.textMuted} />
                          <Text style={{
                            fontSize: 12, fontWeight: active ? '600' : '400',
                            color: active ? n.chipActiveText : n.textSecondary,
                          }}>
                            {t.label}
                          </Text>
                          {active && <Ionicons name="checkmark" size={12} color={joyful.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Texte libre */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: n.textMuted }}>Précisions (optionnel)</Text>
                    <Text style={{ fontSize: 11, color: n.placeholder }}>{freeText.length}/500</Text>
                  </View>
                  <TextInput
                    style={{
                      backgroundColor: n.surface, borderWidth: 1, borderColor: n.border, borderRadius: 12,
                      paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: n.text, minHeight: 90,
                      textAlignVertical: 'top',
                    }}
                    placeholder="Symptômes, antécédents, traitement en cours…"
                    placeholderTextColor={n.placeholder}
                    value={freeText}
                    onChangeText={t => setFreeText(t.slice(0, 500))}
                    multiline
                    numberOfLines={4}
                  />
                  <Text style={{ fontSize: 11, color: n.placeholder, marginTop: 4, fontStyle: 'italic' }}>
                    Un contexte précis accélère l'interprétation par le cardiologue.
                  </Text>
                </View>
              </View>
            )}

            {/* ── ÉTAPE 4 : RÉCAPITULATIF + ENVOI ────────────────────────── */}
            {step === 4 && (
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: n.text }}>Récapitulatif</Text>

                <View style={{
                  backgroundColor: n.surface, borderRadius: 16, overflow: 'hidden',
                  borderWidth: 1, borderColor: n.listBorder,
                }}>
                  {/* Patient */}
                  <View style={recapRowStyle}>
                    <View style={recapIconStyle}><Ionicons name="person" size={18} color={joyful.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={recapLabelStyle}>Patient</Text>
                      <Text style={recapValueStyle}>{patientDisplayName}</Text>
                      {isNewPatient && newPatientDob ? (
                        <Text style={recapSubStyle}>{newPatientDob} — {newPatientGender === 'M' ? 'Masculin' : 'Féminin'}</Text>
                      ) : selectedPatient?.date_of_birth ? (
                        <Text style={recapSubStyle}>{selectedPatient.date_of_birth}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: n.divider, marginHorizontal: 16 }} />

                  {/* Fichier */}
                  <View style={recapRowStyle}>
                    <View style={recapIconStyle}><Ionicons name="document-attach" size={18} color={joyful.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={recapLabelStyle}>Fichier ECG</Text>
                      <Text style={recapValueStyle}>{fileDisplayName}</Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: n.divider, marginHorizontal: 16 }} />

                  {/* Urgence */}
                  <View style={recapRowStyle}>
                    <View style={[recapIconStyle, urgency === 'urgent' && { backgroundColor: '#fee2e2' }]}>
                      <Ionicons name={urgency === 'urgent' ? 'flash' : 'time-outline'} size={18} color={urgency === 'urgent' ? '#ef4444' : joyful.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={recapLabelStyle}>Urgence</Text>
                      <Text style={[recapValueStyle, urgency === 'urgent' && { color: '#ef4444', fontWeight: '700' }]}>
                        {urgency === 'urgent' ? 'URGENT' : 'Normal'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: n.divider, marginHorizontal: 16 }} />

                  {/* Contexte */}
                  <View style={recapRowStyle}>
                    <View style={recapIconStyle}><Ionicons name="chatbox-ellipses-outline" size={18} color={joyful.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={recapLabelStyle}>Contexte clinique</Text>
                      <Text style={recapValueStyle} numberOfLines={3}>
                        {buildClinicalContext() || 'Non renseigné'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress bar pendant envoi */}
                {submitting && (
                  <View style={{ gap: 6 }}>
                    <ProgressBar percent={uploadPercent} />
                    <Text style={{ textAlign: 'center', fontSize: 12, color: n.textMuted }}>
                      Envoi en cours… {uploadPercent}%
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: n.footerBg, borderTopWidth: 1, borderTopColor: n.divider,
            flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 10,
            paddingBottom: insets.bottom + 8,
          }}
        >
          {step > 1 && (
            <TouchableOpacity
              style={{
                flex: 1, borderWidth: 1, borderColor: n.border, borderRadius: 12,
                paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
              }}
              onPress={prevStep}
              disabled={submitting}
            >
              <Ionicons name="arrow-back" size={16} color={n.textSecondary} />
              <Text style={{ color: n.textSecondary, fontWeight: '500', fontSize: 13 }}>Retour</Text>
            </TouchableOpacity>
          )}

          {step < 4 ? (
            <TouchableOpacity
              style={{
                flex: step === 1 ? 1 : 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 6,
                backgroundColor: canGoNext() ? joyful.primary : n.btnDisabled,
              }}
              onPress={nextStep}
              disabled={!canGoNext()}
            >
              <Text style={{
                fontWeight: '600', fontSize: 13,
                color: canGoNext() ? 'white' : n.placeholder,
              }}>
                Suivant
              </Text>
              <Ionicons name="arrow-forward" size={16} color={canGoNext() ? 'white' : n.placeholder} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
                backgroundColor: submitting ? joyful.primaryLight : joyful.primary,
                elevation: submitting ? 0 : 4,
                shadowColor: joyful.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
              }}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="white" size="small" />
                : (
                  <>
                    <Ionicons name="send" size={16} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Envoyer la demande</Text>
                  </>
                )
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
