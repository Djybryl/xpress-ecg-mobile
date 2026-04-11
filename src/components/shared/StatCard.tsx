import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  value: number | string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  /** Tailwind class string pour le fond de la carte ex: "bg-sky-50 dark:bg-sky-950" */
  colorClass?: string;
  onPress?: () => void;
}

/**
 * Carte de statistique réutilisable entre les dashboards de tous les rôles.
 */
export function StatCard({
  value,
  label,
  icon,
  iconBg = '#ede9fe',
  iconColor = '#7c3aed',
  colorClass = 'bg-white dark:bg-zinc-900',
  onPress,
}: StatCardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.85}
      className={`flex-1 ${colorClass} rounded-2xl p-3 shadow-sm`}
    >
      {icon != null && (
        <View
          style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
        >
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      )}
      <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">
        {typeof value === 'number' ? value.toString() : value}
      </Text>
      <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-tight">{label}</Text>
    </Wrapper>
  );
}
