import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/apiClient';

interface EmolumentPeriod {
  period_label: string;
  period_start: string;
  period_end: string;
  ecg_count: number;
  total_fcfa: number;
  status: 'pending' | 'paid';
}

export default function CommissionsFinancieresScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<EmolumentPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<EmolumentPeriod[]>(`/economy/cardiologists/${user.id}/emoluments`);
      setData(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const currentPeriod = data[0] ?? null;
  const history = data.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: joyful.neutral.border,
        backgroundColor: joyful.neutral.surface,
      }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: joyful.primaryDark }}>
          Mes commissions
        </Text>
        <Text style={{ fontSize: 12, color: joyful.neutral.textMuted, marginTop: 2 }}>
          Rémunérations sur ECG payants interprétés
        </Text>
      </View>

      <ScrollView contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: insets.bottom + 24,
      }}>
        {loading ? (
          <ActivityIndicator color={joyful.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#ef4444', marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity
              onPress={() => void load()}
              style={{
                backgroundColor: joyful.primary,
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : !currentPeriod ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>💰</Text>
            <Text style={{
              color: joyful.neutral.textMuted,
              textAlign: 'center',
              fontSize: 14,
              lineHeight: 22,
            }}>
              Aucune commission disponible.{'\n'}
              Les données apparaîtront après vos premières interprétations payantes.
            </Text>
          </View>
        ) : (
          <>
            {/* Période courante */}
            <View style={{
              backgroundColor: joyful.neutral.surface,
              borderRadius: 20,
              padding: 20,
              marginBottom: 16,
              borderWidth: 2,
              borderColor: joyful.primaryLight,
            }}>
              <Text style={{
                fontSize: 12,
                color: joyful.neutral.textMuted,
                fontWeight: '600',
                marginBottom: 8,
                letterSpacing: 0.5,
              }}>
                PÉRIODE EN COURS — {currentPeriod.period_label.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 36, fontWeight: '800', color: joyful.primaryDark }}>
                {currentPeriod.total_fcfa.toLocaleString('fr-FR')} FCFA
              </Text>
              <Text style={{
                fontSize: 13,
                color: joyful.neutral.textSecondary,
                marginTop: 6,
              }}>
                {currentPeriod.ecg_count} ECG payant
                {currentPeriod.ecg_count > 1 ? 's' : ''} interprété
                {currentPeriod.ecg_count > 1 ? 's' : ''}
              </Text>
              {currentPeriod.ecg_count > 0 && (
                <Text style={{ fontSize: 12, color: joyful.neutral.textMuted, marginTop: 4 }}>
                  Tarif moyen :{' '}
                  {Math.round(currentPeriod.total_fcfa / currentPeriod.ecg_count).toLocaleString('fr-FR')}{' '}
                  FCFA / ECG
                </Text>
              )}
              <View style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: joyful.neutral.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: currentPeriod.status === 'paid' ? '#22c55e' : '#f59e0b',
                }} />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: currentPeriod.status === 'paid' ? '#15803d' : '#92400e',
                }}>
                  {currentPeriod.status === 'paid' ? 'Versé' : 'En attente de versement'}
                </Text>
              </View>
            </View>

            {history.length > 0 && (
              <View>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: joyful.neutral.textMuted,
                  marginBottom: 10,
                  letterSpacing: 0.5,
                }}>
                  HISTORIQUE
                </Text>
                <View style={{
                  backgroundColor: joyful.neutral.surface,
                  borderRadius: 16,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: joyful.neutral.border,
                }}>
                  {history.map((period, index) => (
                    <View key={period.period_start}>
                      {index > 0 && (
                        <View style={{
                          height: 1,
                          backgroundColor: joyful.neutral.divider,
                          marginHorizontal: 16,
                        }} />
                      )}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: joyful.neutral.text,
                          }}>
                            {period.period_label}
                          </Text>
                          <Text style={{
                            fontSize: 12,
                            color: joyful.neutral.textMuted,
                            marginTop: 2,
                          }}>
                            {period.ecg_count} ECG
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{
                            fontSize: 15,
                            fontWeight: '700',
                            color: joyful.primaryDark,
                          }}>
                            {period.total_fcfa.toLocaleString('fr-FR')} FCFA
                          </Text>
                          <Text style={{
                            fontSize: 11,
                            marginTop: 2,
                            color: period.status === 'paid' ? '#15803d' : '#92400e',
                            fontWeight: '600',
                          }}>
                            {period.status === 'paid' ? '✓ Versé' : '⏳ En attente'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
