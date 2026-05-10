import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';

export default function PlusScreen() {
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  const ITEMS = [
    {
      section: 'OUTILS',
      items: [
        { label: 'Historique ECG', icon: 'time-outline', route: '/(cardiologue)/history', available: true },
        { label: 'Second avis', icon: 'people-outline', route: '/(cardiologue)/second-opinions', available: true },
      ],
    },
    {
      section: 'FINANCES',
      items: [
        { label: 'Ratios Give & Get', icon: 'analytics-outline', route: '/(cardiologue)/commissions', available: true },
        { label: 'Mes commissions', icon: 'cash-outline', route: '/(cardiologue)/commissions-financieres', available: true },
      ],
    },
    {
      section: 'PROCHAINEMENT',
      items: [
        { label: 'Urgences rythmiques', icon: 'flash-outline', route: null, available: false },
        { label: 'Formation ECG', icon: 'school-outline', route: null, available: false },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: joyful.screenBg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: joyful.primaryDark }}>
          Plus
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
        {ITEMS.map(group => (
          <View key={group.section} style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: joyful.neutral.textMuted,
              letterSpacing: 1, marginBottom: 8,
            }}
            >
              {group.section}
            </Text>
            <View style={{
              backgroundColor: joyful.neutral.surface, borderRadius: 16,
              overflow: 'hidden', borderWidth: 1, borderColor: joyful.neutral.border,
            }}
            >
              {group.items.map((item, index) => (
                <View key={item.label}>
                  {index > 0 && (
                    <View style={{ height: 1, backgroundColor: joyful.neutral.divider, marginHorizontal: 16 }} />
                  )}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                      paddingVertical: 14, opacity: item.available ? 1 : 0.4,
                    }}
                    onPress={() => item.available && item.route && router.push(item.route as any)}
                    disabled={!item.available}
                    activeOpacity={0.7}
                    accessibilityLabel={item.available ? item.label : `${item.label} — bientôt disponible`}
                    accessibilityRole="button"
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: joyful.primaryMuted, alignItems: 'center',
                      justifyContent: 'center', marginRight: 12,
                    }}
                    >
                      <Ionicons name={item.icon as any} size={20} color={joyful.primary} />
                    </View>
                    <Text style={{
                      flex: 1, fontSize: 15, fontWeight: '500',
                      color: joyful.neutral.text,
                    }}
                    >
                      {item.label}
                    </Text>
                    {!item.available ? (
                      <View style={{
                        backgroundColor: joyful.primaryMuted, borderRadius: 8,
                        paddingHorizontal: 8, paddingVertical: 3,
                      }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: joyful.primary }}>
                          Bientôt
                        </Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={joyful.neutral.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
