import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors, Radius, Shadow, Spacing, Typography } from '../lib/theme';
import { MaintenanceIssue, PRIORITY_COLORS, PRIORITY_LABELS } from '../types';

interface Props {
  issue: MaintenanceIssue;
  onPress?: () => void;
  onToggleStatus?: () => void;
  showProperty?: boolean;
}

export default function IssueCard({ issue, onPress, onToggleStatus, showProperty = false }: Props) {
  const isOpen = issue.status === 'open';

  return (
    <View style={[styles.card, !isOpen && styles.cardDone]}>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={onPress ? 0.85 : 1}
      >
        {/* Status icon */}
        <TouchableOpacity
          style={[styles.statusIcon, isOpen ? styles.statusOpen : styles.statusDone]}
          onPress={onToggleStatus}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isOpen ? 'ellipse-outline' : 'checkmark-circle'}
            size={22}
            color={isOpen ? Colors.danger : Colors.success}
          />
        </TouchableOpacity>

        {/* Body */}
        <View style={styles.body}>
          <Text
            style={[styles.title, !isOpen && styles.titleDone]}
            numberOfLines={2}
          >
            {issue.title}
          </Text>

          {/* Priority badge */}
          {isOpen && issue.priority && issue.priority !== 'medium' && (
            <View style={[
              styles.priorityPill,
              { backgroundColor: PRIORITY_COLORS[issue.priority] + '20' },
            ]}>
              <Text style={[styles.priorityText, { color: PRIORITY_COLORS[issue.priority] }]}>
                {PRIORITY_LABELS[issue.priority]}
              </Text>
            </View>
          )}

          {showProperty && issue.property && (
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{issue.property.name}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {format(new Date(issue.created_at), 'MMM d, yyyy')}
            </Text>

            {issue.assignee && (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.metaText}>{issue.assignee.full_name}</Text>
              </>
            )}
          </View>
        </View>

        {/* Status pill */}
        <View style={[styles.pill, isOpen ? styles.pillOpen : styles.pillDone]}>
          <Text style={[styles.pillText, isOpen ? styles.pillTextOpen : styles.pillTextDone]}>
            {isOpen ? 'Open' : 'Done'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  cardDone: {
    opacity: 0.75,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statusIcon: {
    padding: 2,
  },
  statusOpen: {},
  statusDone: {},
  body: {
    flex: 1,
  },
  title: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 4,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  priorityPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    ...Typography.caption,
  },
  dot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillOpen: {
    backgroundColor: Colors.danger + '20',
  },
  pillDone: {
    backgroundColor: Colors.success + '20',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextOpen: {
    color: Colors.danger,
  },
  pillTextDone: {
    color: Colors.success,
  },
});
