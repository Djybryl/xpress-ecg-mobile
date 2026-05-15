import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

const CACHE_KEY = 'xecg-financial-summary';
const CACHE_TTL_MS = 10 * 60 * 1000;

export type CardiologistFinancialSummary = {
  period: string;
  xpress_global: {
    ecg_count: number;
    emoluments_standard: number;
    emoluments_urgent: number;
    emoluments_cagnotte: number;
    total: number;
  };
  crc: {
    ecg_count: number;
    emoluments: number;
    frais_plateforme: number;
    net: number;
  } | null;
  institutional: Array<{
    institution_id: string;
    institution_name: string;
    ecg_count: number;
    emoluments: number;
    frais_plateforme: number;
    net: number;
  }>;
  total_brut: number;
  total_frais: number;
  total_net: number;
  virement_prevu: string;
};

type CacheWrap = {
  entries: Record<string, { ts: number; summary: CardiologistFinancialSummary }>;
};

function currentMonthYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonthsYm(count: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const dt = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function formatMonthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} FCFA`;
}

async function readCacheWrap(): Promise<CacheWrap> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return { entries: {} };
    const p = JSON.parse(raw) as CacheWrap;
    if (!p.entries || typeof p.entries !== 'object') return { entries: {} };
    return p;
  } catch {
    return { entries: {} };
  }
}

async function writeCacheEntry(month: string, summary: CardiologistFinancialSummary): Promise<void> {
  try {
    const wrap = await readCacheWrap();
    wrap.entries[month] = { ts: Date.now(), summary };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(wrap));
  } catch {
    /* ignore */
  }
}

async function readFreshCache(month: string): Promise<CardiologistFinancialSummary | null> {
  const wrap = await readCacheWrap();
  const e = wrap.entries[month];
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) return null;
  return e.summary;
}

async function readStaleCache(month: string): Promise<CardiologistFinancialSummary | null> {
  const wrap = await readCacheWrap();
  return wrap.entries[month]?.summary ?? null;
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.code === 'SERVER_UNREACHABLE' || err.code === 'REQUEST_TIMEOUT';
  }
  return false;
}

function MetricRow({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  const { colors: joyful } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: subtle ? 'rgba(255,255,255,0.85)' : joyful.neutral.textMuted,
          flex: 1,
          paddingRight: 8,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: joyful.neutral.text }}>{value}</Text>
    </View>
  );
}

function AccentMetricRow({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 13, color: labelColor, flex: 1, paddingRight: 8 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: valueColor }}>{value}</Text>
    </View>
  );
}

export default function CommissionsFinancieresScreen() {
  const { user } = useAuth();
  const { colors: joyful, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const months = useMemo(() => lastMonthsYm(6), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthYm);
  const [summary, setSummary] = useState<CardiologistFinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);

  const [expGlobal, setExpGlobal] = useState(true);
  const [expCrc, setExpCrc] = useState(true);
  const [expInst, setExpInst] = useState(true);

  const cardiologue = user?.role === 'cardiologue';

  const load = useCallback(
    async (month: string, opts?: { forceRefresh?: boolean }) => {
      if (!cardiologue) return;
      const forceRefresh = opts?.forceRefresh ?? false;

      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      if (!forceRefresh) setFromCacheOnly(false);

      try {
        if (!forceRefresh) {
          const cached = (await readFreshCache(month)) ?? (await readStaleCache(month));
          setSummary(cached?.period === month ? cached : null);
        }

        const data = await api.get<CardiologistFinancialSummary>('/economy/cardiologists/me/financial-summary', {
          month,
        });
        await writeCacheEntry(month, data);
        setSummary(data);
        setFromCacheOnly(false);
        setError(null);
      } catch (e) {
        if (isNetworkFailure(e)) {
          const stale = await readStaleCache(month);
          if (stale && stale.period === month) {
            setSummary(stale);
            setFromCacheOnly(true);
            setError(null);
          } else {
            setError(getApiErrorMessage(e));
          }
        } else {
          setError(getApiErrorMessage(e));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cardiologue],
  );

  useEffect(() => {
    void load(selectedMonth);
  }, [load, selectedMonth]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(selectedMonth, { forceRefresh: true });
  }, [load, selectedMonth]);

  const monthLabelShort = useMemo(() => formatMonthTitle(selectedMonth), [selectedMonth]);
  const xg = summary?.xpress_global;
  const summaryMatchesMonth = summary?.period === selectedMonth;
  const showContent = !!summaryMatchesMonth && !!xg;

  if (!cardiologue) {
    return (
      <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
        <View style={{ padding: 24 }}>
          <Text style={{ color: joyful.neutral.textMuted }}>Réservé aux cardiologues.</Text>
        </View>
      </View>
    );
  }

  const showCrc = summary != null && summary.crc != null;
  const showInst = summary != null && summary.institutional.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: joyful.neutral.border,
        backgroundColor: joyful.neutral.surface,
      }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: joyful.primaryDark }}>
          {`Mes finances · ${monthLabelShort}`}
        </Text>
        <Text style={{ fontSize: 12, color: joyful.neutral.textMuted, marginTop: 4 }}>
          Synthèse par source (globale, CRC, institutionnel)
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: joyful.neutral.border, backgroundColor: joyful.neutral.surface }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {months.map(ym => {
          const sel = ym === selectedMonth;
          return (
            <TouchableOpacity
              key={ym}
              onPress={() => setSelectedMonth(ym)}
              accessibilityRole="button"
              accessibilityLabel={`Mois ${formatMonthTitle(ym)}`}
              accessibilityState={{ selected: sel }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: sel ? joyful.primaryMuted : joyful.neutral.toggleBg,
                borderWidth: sel ? 2 : 1,
                borderColor: sel ? joyful.primary : joyful.neutral.border,
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: sel ? '800' : '600',
                color: sel ? joyful.primaryDark : joyful.neutral.textSecondary,
              }}
              >
                {formatMonthTitle(ym)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {fromCacheOnly ? (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            backgroundColor: '#fef3c7',
            borderWidth: 1,
            borderColor: '#fcd34d',
          }}
          accessibilityRole="alert"
          accessibilityLabel="Données hors ligne"
        >
          <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '600' }}>
            Données hors ligne — affichage du cache.
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 16,
        }}
        refreshControl={(
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />
        )}
      >
        {(loading || refreshing) && !showContent ? (
          <ActivityIndicator color={joyful.primary} style={{ marginTop: 40 }} accessibilityLabel="Chargement" />
        ) : error && !showContent ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#ef4444', marginBottom: 12, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity
              onPress={() => void load(selectedMonth, { forceRefresh: true })}
              accessibilityRole="button"
              accessibilityLabel="Réessayer le chargement"
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
        ) : showContent && summary && xg ? (
          <>
            {/* Section 1 — Xpress global */}
            <View style={{ marginBottom: 12, borderRadius: 18, overflow: 'hidden' }}>
              <TouchableOpacity
                onPress={() => setExpGlobal(e => !e)}
                accessibilityRole="button"
                accessibilityLabel="Xpress ECG global, section déploiable"
                accessibilityState={{ expanded: expGlobal }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 14,
                  backgroundColor: joyful.primary,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Xpress ECG global</Text>
                <Ionicons name={expGlobal ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
              </TouchableOpacity>
              {expGlobal ? (
                <View style={{ padding: 14, backgroundColor: joyful.primaryMuted }}>
                  <AccentMetricRow label="ECG (interprétations)" value={String(xg.ecg_count)} labelColor={joyful.primaryDark} valueColor={joyful.primaryDark} />
                  <AccentMetricRow label="Émoluments standard" value={formatFcfa(xg.emoluments_standard)} labelColor={joyful.primaryDark} valueColor={joyful.primaryDark} />
                  <AccentMetricRow label="Urgents" value={formatFcfa(xg.emoluments_urgent)} labelColor={joyful.primaryDark} valueColor={joyful.primaryDark} />
                  <AccentMetricRow label="Cagnotte" value={formatFcfa(xg.emoluments_cagnotte)} labelColor={joyful.primaryDark} valueColor={joyful.primaryDark} />
                  <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: joyful.neutral.border }}>
                    <AccentMetricRow label="Total" value={formatFcfa(xg.total)} labelColor={joyful.primaryDark} valueColor={joyful.primaryDark} />
                  </View>
                </View>
              ) : null}
            </View>

            {/* Section 2 — CRC */}
            {showCrc && summary.crc ? (
              <View style={{ marginBottom: 12, borderRadius: 18, overflow: 'hidden' }}>
                <TouchableOpacity
                  onPress={() => setExpCrc(e => !e)}
                  accessibilityRole="button"
                  accessibilityLabel="Mon réseau CRC, section déploiable"
                  accessibilityState={{ expanded: expCrc }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    backgroundColor: '#4C1D95',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Mon réseau CRC</Text>
                  <Ionicons name={expCrc ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
                </TouchableOpacity>
                {expCrc ? (
                  <View style={{ padding: 14, backgroundColor: 'rgba(76,29,149,0.12)' }}>
                    <AccentMetricRow label="ECG" value={String(summary.crc.ecg_count)} labelColor="#4C1D95" valueColor="#3730a3" />
                    <AccentMetricRow label="Émoluments" value={formatFcfa(summary.crc.emoluments)} labelColor="#4C1D95" valueColor="#3730a3" />
                    <AccentMetricRow label="Frais plateforme" value={formatFcfa(summary.crc.frais_plateforme)} labelColor="#4C1D95" valueColor="#3730a3" />
                    <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: joyful.neutral.border }}>
                      <AccentMetricRow label="Net" value={formatFcfa(summary.crc.net)} labelColor="#4C1D95" valueColor="#3730a3" />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Section 3 — Institutionnel */}
            {showInst ? (
              <View style={{ marginBottom: 12, borderRadius: 18, overflow: 'hidden' }}>
                <TouchableOpacity
                  onPress={() => setExpInst(e => !e)}
                  accessibilityRole="button"
                  accessibilityLabel="ECG institutionnels, section déploiable"
                  accessibilityState={{ expanded: expInst }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    backgroundColor: '#065F46',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>ECG institutionnels</Text>
                  <Ionicons name={expInst ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
                </TouchableOpacity>
                {expInst ? (
                  <View style={{ padding: 14, backgroundColor: 'rgba(6,95,70,0.1)' }}>
                    {summary.institutional.map((row, idx) => (
                      <View
                        key={row.institution_id}
                        style={{
                          marginBottom: idx < summary.institutional.length - 1 ? 12 : 0,
                          paddingBottom: idx < summary.institutional.length - 1 ? 12 : 0,
                          borderBottomWidth: idx < summary.institutional.length - 1 ? 1 : 0,
                          borderBottomColor: joyful.neutral.border,
                        }}
                      >
                        <Text style={{ fontWeight: '800', fontSize: 15, color: '#065F46', marginBottom: 6 }}>
                          {row.institution_name || 'Institution'}
                        </Text>
                        <AccentMetricRow label="ECG" value={String(row.ecg_count)} labelColor="#047857" valueColor="#064e3b" />
                        <AccentMetricRow label="Émoluments" value={formatFcfa(row.emoluments)} labelColor="#047857" valueColor="#064e3b" />
                        <AccentMetricRow label="Frais" value={formatFcfa(row.frais_plateforme)} labelColor="#047857" valueColor="#064e3b" />
                        <AccentMetricRow label="Net" value={formatFcfa(row.net)} labelColor="#047857" valueColor="#064e3b" />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Espace sous le dernier bloc pour éviter que le pied fixe ne masque */}
            <View style={{ height: insets.bottom + 120 }} />
          </>
        ) : (
          <View style={{ paddingTop: 40 }}>
            <Text style={{ color: joyful.neutral.textMuted, textAlign: 'center' }}>Aucune donnée.</Text>
          </View>
        )}
      </ScrollView>

      {summaryMatchesMonth && summary ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Totaux mensuels, brut ${formatFcfa(summary.total_brut)}, frais ${formatFcfa(summary.total_frais)}, net ${formatFcfa(summary.total_net)}`}
          style={{
            borderTopWidth: 1,
            borderTopColor: joyful.neutral.border,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: isDark ? '#27272a' : '#f3f4f6',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: joyful.neutral.text, marginBottom: 8 }}>
            Totaux (mois)
          </Text>
          <MetricRow label="Total brut" value={formatFcfa(summary.total_brut)} />
          <MetricRow label="Total frais" value={formatFcfa(summary.total_frais)} />
          <MetricRow label="Total net" value={formatFcfa(summary.total_net)} />
          <Text
            style={{ fontSize: 12, color: joyful.neutral.textMuted, marginTop: 8, fontWeight: '600' }}
            accessibilityRole="text"
          >
            {`Date virement prévu : ${summary.virement_prevu}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
