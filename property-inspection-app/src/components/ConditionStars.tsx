import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../lib/theme';
import { CONDITION_COLORS, CONDITION_LABELS } from '../data/checklist';

interface Props {
  value?: number;
  onChange?: (score: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ConditionStars({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: Props) {
  const starSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 26;
  const color = value ? CONDITION_COLORS[value] : Colors.textMuted;

  return (
    <View style={styles.container}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => !readonly && onChange?.(n)}
            disabled={readonly}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons
              name={value && n <= value ? 'star' : 'star-outline'}
              size={starSize}
              color={value && n <= value ? color : Colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>
      {value ? (
        <Text style={[styles.label, { color }]}>{CONDITION_LABELS[value]}</Text>
      ) : !readonly ? (
        <Text style={styles.placeholder}>Tap to rate</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  label: {
    ...Typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  placeholder: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
