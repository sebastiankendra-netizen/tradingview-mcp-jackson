import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors, Radius, Shadow, Spacing, Typography } from '../lib/theme';
import { CONDITION_COLORS, CONDITION_LABELS } from '../data/checklist';
import { Property } from '../types';

interface Props {
  property: Property;
  lastInspectionDate?: string;
  conditionScore?: number;
  openIssuesCount?: number;
  onPress: () => void;
}

export default function PropertyCard({
  property,
  lastInspectionDate,
  conditionScore,
  openIssuesCount = 0,
  onPress,
}: Props) {
  const scoreColor = conditionScore ? CONDITION_COLORS[conditionScore] : Colors.textMuted;
  const scoreLabel = conditionScore ? CONDITION_LABELS[conditionScore] : 'Not inspected';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.row}>
        {/* Property thumbnail */}
        <View style={styles.thumb}>
          {property.photo_url ? (
            <Image source={{ uri: property.photo_url }} style={styles.thumbImage} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="business" size={24} color={Colors.primary} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {property.name}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {property.address}, {property.city}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>
              {lastInspectionDate
                ? `Inspected ${format(new Date(lastInspectionDate), 'MMM d, yyyy')}`
                : 'Never inspected'}
            </Text>
          </View>
        </View>

        {/* Score badge */}
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '20' }]}>
          <Text style={[styles.scoreNumber, { color: scoreColor }]}>
            {conditionScore ?? '—'}
          </Text>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>
            {conditionScore ? scoreLabel : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Open issues pill */}
      {openIssuesCount > 0 && (
        <View style={styles.issuesBadge}>
          <Ionicons name="warning" size={12} color={Colors.warning} />
          <Text style={styles.issuesText}>
            {openIssuesCount} open {openIssuesCount === 1 ? 'issue' : 'issues'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  name: {
    ...Typography.h3,
    marginBottom: 2,
  },
  address: {
    ...Typography.bodySmall,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...Typography.caption,
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 52,
  },
  scoreNumber: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  issuesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    backgroundColor: Colors.warning + '15',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    gap: 4,
  },
  issuesText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },
});
