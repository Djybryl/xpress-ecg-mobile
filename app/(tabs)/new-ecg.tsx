import { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, Image, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { usePatientList, type PatientItem } from '@/hooks/usePatientList';
import { api } from '@/lib/apiClient';

// ─── Constantes ──────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const CLINICAL_TEMPLATES = [
  { id: 'chest', label: '💔 Douleur thoracique', text: 'Patient présentant une douleur thoracique. ' },
  { id: 'palp', label: '❤️ Palpitations', text: 'Patient se plaignant de palpitations. ' },
  { id: 'dysp', label: '😮‍💨 Dyspnée', text: 'Patient présentant une dyspnée. ' },
  { id: 'sync', label: '😵 Syncope', text: 'Patient ayant présenté un malaise/syncope. ' },
  { id: 'check', label: '✅ Bilan systématique', text: 'ECG réalisé dans le cadre d\'un bilan systématique. ' },
  { id: 'preop', label: '🔪 Pré-opératoire', text: 'ECG pré-opératoire. ' },
  { id: 'follow', label: '🔄 Suivi', text: 'ECG de contrôle/suivi. ' },
];

// ─── Composants UI ────────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: Step }) {
  const done = step < current;
  const active = step === current;
  return (
    <View className="items-center">
      <View className={`w-8 h-8 rounded-full items-center justify-center ${
        done ? 'bg-green-500' : active ? 'bg-indigo-600' : 'bg-gray-200'
      }`}>
        <Text className={`text-xs font-bold ${done || active ? 'text-white' : 'text-gray-400'}`}>
          {done ? '✓' : step}
        </Text>
      </View>
    </View>
  );
}

function StepBar({ current }: { current: Step }) {
  const labels = ['Patient', 'Fichier ECG', 'Contexte'];
  return (
    <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100">
      {[1, 2, 3].map((s, i) => (
        <View key={s} className="flex-row flex-1 items-center">
          <View className="items-center flex-1">
            <StepIndicator step={s} current={current} />
            <Text className={`text-[10px] mt-1 ${s === current ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              {labels[i]}
            </Text>
          </View>
          {i < 2 && (
            <View className={`flex-1 h-0.5 mx-1 mb-4 ${s < current ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function NewEcgScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Données formulaire
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientDob, setNewPatientDob] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'M' | 'F' | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [ecgFile, setEcgFile] = useState<{ uri: string; name: string; type: string } | null>(null);

  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [clinicalContext, setClinicalContext] = useState('');

  const { patients, loading: patientsLoading } = usePatientList({
    limit: 200,
    enabled: !!user?.id,
  });

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Actions fichier ────────────────────────────────────────────────────────

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra dans les paramètres.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.92,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = `ecg_${Date.now()}.jpg`;
      setEcgFile({ uri: asset.uri, name, type: 'image/jpeg' });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les paramètres.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.92,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `ecg_${Date.now()}.jpg`;
      const type = asset.mimeType ?? 'image/jpeg';
      setEcgFile({ uri: asset.uri, name, type });
    }
  }, []);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf', 'application/dicom', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setEcgFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' });
    }
  }, []);

  // ── Soumission ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!ecgFile || !user) return;
    setSubmitting(true);

    try {
      const formData = new FormData();

      // Patient
      if (selectedPatient) {
        formData.append('patientId', selectedPatient.id);
      } else {
        formData.append('patientName', newPatientName.trim());
        formData.append('patientDateOfBirth', newPatientDob.trim());
        formData.append('patientGender', newPatientGender);
      }

      // Fichier ECG
      formData.append('file', {
        uri: ecgFile.uri,
        name: ecgFile.name,
        type: ecgFile.type,
      } as unknown as Blob);

      // Méta
      formData.append('urgency', urgency);
      formData.append('clinicalContext', clinicalContext.trim());
      formData.append('ecgDate', new Date().toISOString().slice(0, 10));

      await api.upload('/ecg-records', formData);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '✅ Demande envoyée',
        'Votre demande ECG a été transmise avec succès. Vous serez notifié dès qu\'un rapport est disponible.',
        [{ text: 'OK', onPress: () => { resetForm(); router.push('/(tabs)/requests'); } }],
      );
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', e instanceof Error ? e.message : 'L\'envoi a échoué. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }, [ecgFile, user, selectedPatient, newPatientName, newPatientDob, newPatientGender, urgency, clinicalContext]);

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
    setClinicalContext('');
  }, []);

  const canGoNext = (): boolean => {
    if (step === 1) {
      if (isNewPatient) return newPatientName.trim().length >= 2 && newPatientDob.trim().length >= 8 && !!newPatientGender;
      return selectedPatient !== null;
    }
    if (step === 2) return ecgFile !== null;
    return true;
  };

  const nextStep = async () => {
    if (!canGoNext()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => (s < 3 ? (s + 1) as Step : s));
  };

  const prevStep = () => {
    if (step > 1) setStep(s => (s - 1) as Step);
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-4 pb-2 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Nouvelle demande ECG</Text>
      </View>

      <StepBar current={step} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        >
          {/* ÉTAPE 1 : PATIENT */}
          {step === 1 && (
            <View>
              {/* Onglets patient existant / nouveau */}
              <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
                <TouchableOpacity
                  className={`flex-1 py-2 rounded-lg items-center ${!isNewPatient ? 'bg-white shadow-sm' : ''}`}
                  onPress={() => setIsNewPatient(false)}
                >
                  <Text className={`text-sm font-medium ${!isNewPatient ? 'text-gray-900' : 'text-gray-500'}`}>
                    Patient existant
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-2 rounded-lg items-center ${isNewPatient ? 'bg-white shadow-sm' : ''}`}
                  onPress={() => setIsNewPatient(true)}
                >
                  <Text className={`text-sm font-medium ${isNewPatient ? 'text-gray-900' : 'text-gray-500'}`}>
                    Nouveau patient
                  </Text>
                </TouchableOpacity>
              </View>

              {!isNewPatient ? (
                <>
                  {/* Recherche patient existant */}
                  <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 h-11 mb-3">
                    <Text className="text-gray-400 mr-2">🔍</Text>
                    <TextInput
                      className="flex-1 text-sm text-gray-800"
                      placeholder="Nom du patient…"
                      placeholderTextColor="#9ca3af"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  {patientsLoading
                    ? <ActivityIndicator color="#4f46e5" className="my-8" />
                    : (
                      <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                        {filteredPatients.slice(0, 30).map((patient, index) => (
                          <View key={patient.id}>
                            {index > 0 && <View className="h-px bg-gray-100 mx-4" />}
                            <TouchableOpacity
                              className={`flex-row items-center px-4 py-3 ${selectedPatient?.id === patient.id ? 'bg-indigo-50' : ''}`}
                              onPress={() => setSelectedPatient(patient)}
                              activeOpacity={0.7}
                            >
                              <View className="w-9 h-9 rounded-full bg-indigo-100 items-center justify-center mr-3">
                                <Text className="text-xs font-bold text-indigo-600">
                                  {patient.name.slice(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <View className="flex-1">
                                <Text className="text-sm font-medium text-gray-900">{patient.name}</Text>
                                {patient.date_of_birth && (
                                  <Text className="text-xs text-gray-500">{patient.date_of_birth}</Text>
                                )}
                              </View>
                              {selectedPatient?.id === patient.id && (
                                <Text className="text-indigo-600 font-bold">✓</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        ))}
                        {filteredPatients.length === 0 && (
                          <View className="py-8 items-center">
                            <Text className="text-gray-500 text-sm">Aucun patient trouvé</Text>
                          </View>
                        )}
                      </View>
                    )
                  }
                </>
              ) : (
                /* Nouveau patient */
                <View className="bg-white rounded-2xl p-4 border border-gray-100">
                  <Text className="text-sm font-semibold text-gray-700 mb-4">Informations du patient</Text>

                  <View className="mb-4">
                    <Text className="text-xs text-gray-500 mb-1">Nom complet *</Text>
                    <TextInput
                      className="border border-gray-200 rounded-xl px-3 h-11 text-sm bg-gray-50 text-gray-900"
                      placeholder="Nom Prénom"
                      value={newPatientName}
                      onChangeText={setNewPatientName}
                      autoCapitalize="words"
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-xs text-gray-500 mb-1">Date de naissance * (AAAA-MM-JJ)</Text>
                    <TextInput
                      className="border border-gray-200 rounded-xl px-3 h-11 text-sm bg-gray-50 text-gray-900"
                      placeholder="1980-01-15"
                      value={newPatientDob}
                      onChangeText={setNewPatientDob}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>

                  <View>
                    <Text className="text-xs text-gray-500 mb-2">Sexe *</Text>
                    <View className="flex-row gap-3">
                      {(['M', 'F'] as const).map(g => (
                        <TouchableOpacity
                          key={g}
                          className={`flex-1 py-2.5 rounded-xl items-center border ${
                            newPatientGender === g
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'bg-white border-gray-200'
                          }`}
                          onPress={() => setNewPatientGender(g)}
                        >
                          <Text className={`text-sm font-medium ${newPatientGender === g ? 'text-white' : 'text-gray-600'}`}>
                            {g === 'M' ? '♂ Masculin' : '♀ Féminin'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ÉTAPE 2 : FICHIER ECG */}
          {step === 2 && (
            <View>
              {/* Bouton caméra en vedette */}
              <TouchableOpacity
                className="bg-indigo-600 rounded-2xl py-5 items-center mb-3 flex-row justify-center gap-3"
                onPress={pickFromCamera}
                activeOpacity={0.85}
                style={{ elevation: 4 }}
              >
                <Text className="text-2xl">📸</Text>
                <View>
                  <Text className="text-white font-bold text-base">Photographier le tracé ECG</Text>
                  <Text className="text-indigo-200 text-xs mt-0.5">Recommandé — qualité optimale</Text>
                </View>
              </TouchableOpacity>

              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  className="flex-1 bg-white border border-gray-200 rounded-2xl py-4 items-center gap-1"
                  onPress={pickFromGallery}
                  activeOpacity={0.8}
                >
                  <Text className="text-2xl">🖼️</Text>
                  <Text className="text-gray-700 text-xs font-medium">Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-white border border-gray-200 rounded-2xl py-4 items-center gap-1"
                  onPress={pickDocument}
                  activeOpacity={0.8}
                >
                  <Text className="text-2xl">📁</Text>
                  <Text className="text-gray-700 text-xs font-medium">PDF / DCM</Text>
                </TouchableOpacity>
              </View>

              {/* Prévisualisation */}
              {ecgFile && (
                <View className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm shadow-gray-100">
                  <View className="flex-row items-center mb-2">
                    <Text className="text-green-500 font-bold mr-2">✓</Text>
                    <Text className="text-gray-800 font-semibold text-sm flex-1" numberOfLines={1}>{ecgFile.name}</Text>
                    <TouchableOpacity onPress={() => setEcgFile(null)}>
                      <Text className="text-gray-400 text-lg px-2">×</Text>
                    </TouchableOpacity>
                  </View>
                  {ecgFile.type.startsWith('image/') && (
                    <Image
                      source={{ uri: ecgFile.uri }}
                      className="w-full h-48 rounded-xl"
                      resizeMode="contain"
                    />
                  )}
                  {!ecgFile.type.startsWith('image/') && (
                    <View className="bg-gray-50 rounded-xl h-20 items-center justify-center">
                      <Text className="text-3xl">📄</Text>
                      <Text className="text-gray-500 text-xs mt-1">{ecgFile.type}</Text>
                    </View>
                  )}
                </View>
              )}

              {!ecgFile && (
                <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                  <Text className="text-amber-700 text-xs">
                    💡 Conseil : pour une meilleure qualité, photographiez le tracé à plat, sans reflet, en cadrant bien le papier complet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ÉTAPE 3 : CONTEXTE CLINIQUE */}
          {step === 3 && (
            <View>
              {/* Urgence */}
              <Text className="text-sm font-semibold text-gray-700 mb-2">Niveau d'urgence</Text>
              <View className="flex-row gap-3 mb-5">
                {(['normal', 'urgent'] as const).map(u => (
                  <TouchableOpacity
                    key={u}
                    className={`flex-1 py-3 rounded-xl items-center border ${
                      urgency === u
                        ? u === 'urgent' ? 'bg-red-500 border-red-500' : 'bg-indigo-600 border-indigo-600'
                        : 'bg-white border-gray-200'
                    }`}
                    onPress={() => setUrgency(u)}
                  >
                    <Text className={`text-sm font-semibold ${urgency === u ? 'text-white' : 'text-gray-600'}`}>
                      {u === 'urgent' ? '⚡ Urgent' : '📅 Normal'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Templates contexte */}
              <Text className="text-sm font-semibold text-gray-700 mb-2">Contexte clinique</Text>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                className="mb-3"
              >
                {CLINICAL_TEMPLATES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    className="bg-white border border-gray-200 px-3 py-2 rounded-xl"
                    onPress={() => setClinicalContext(prev => prev + t.text)}
                  >
                    <Text className="text-xs text-gray-700">{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 min-h-[100px]"
                placeholder="Décrivez ici le contexte clinique (motif de la demande, symptômes, antécédents pertinents…)"
                placeholderTextColor="#9ca3af"
                value={clinicalContext}
                onChangeText={setClinicalContext}
                multiline
                textAlignVertical="top"
                numberOfLines={4}
              />

              {/* Récapitulatif */}
              <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mt-4">
                <Text className="text-sm font-semibold text-indigo-800 mb-2">Récapitulatif</Text>
                <Text className="text-xs text-indigo-700 mb-1">
                  👤 {isNewPatient ? newPatientName : selectedPatient?.name}
                </Text>
                <Text className="text-xs text-indigo-700 mb-1">
                  📎 {ecgFile?.name ?? 'Aucun fichier'}
                </Text>
                <Text className="text-xs text-indigo-700">
                  {urgency === 'urgent' ? '⚡ Urgent' : '📅 Normal'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Boutons navigation */}
        <View
          className="bg-white border-t border-gray-100 flex-row px-4 py-3 gap-3"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          {step > 1 && (
            <TouchableOpacity
              className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              onPress={prevStep}
            >
              <Text className="text-gray-700 font-medium text-sm">← Retour</Text>
            </TouchableOpacity>
          )}

          {step < 3 ? (
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3 items-center ${canGoNext() ? 'bg-indigo-600' : 'bg-gray-200'}`}
              onPress={nextStep}
              disabled={!canGoNext()}
            >
              <Text className={`font-semibold text-sm ${canGoNext() ? 'text-white' : 'text-gray-400'}`}>
                Suivant →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3 items-center ${submitting ? 'bg-indigo-400' : 'bg-indigo-600'}`}
              onPress={handleSubmit}
              disabled={submitting}
              style={{ elevation: submitting ? 0 : 4 }}
            >
              {submitting
                ? <ActivityIndicator color="white" size="small" />
                : <Text className="text-white font-bold text-sm">✉️ Envoyer la demande</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
