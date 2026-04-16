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
import { IssueStatus, MaintenanceIssue, PRIORITY_COLORS, PRIORITY_LABELS } from '../types';

const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; icon: string }> = {
  open:           { label: 'Open',           color: Colors.danger,  icon: 'alert-circle' },
  pending_review: { label: 'Needs Review',   color: '#F39C12',      icon: 'time' },
  done:           { label: 'Done',           color: Colors.success, icon: 'checkmark-circle' },
};

interface Props {
  issue: MaintenanceIssue;
  showProperty?: boolean;
  onPress?: () => void;
  // Role-based actions — pass whichever apply
  onSubmitCompletion?: () => void;  // maintenance tech: submit after photo
  onReviewClose?: () => void;       // manager: review after photo & close
  onReopen?: () => void;            // manager: reopen a done issue
}

export default function IssueCard({
  issue,
  showProperty = false,
  onPress,
  onSubmitCompletion,
  onReviewClose,
  onReopen,
}: Props) {
  const status = (issue.status ?? 'open') as IssueStatus;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const isDone = status === 'done';
  const isPending = status === 'pending_review';

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, isDone && styles.cardDone]}
      {...(onPress ? { onPress, activeOpacity: 0.75 } : {})}
    >
      {/* Status + priority row */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: cfg.color + '20' }]}>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {issue.priority && (
          <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[issue.priority] + '15' }]}>
            <Text style={[styles.priorityText, { color: PRIORITY_COLORS[issue.priority] }]}>
              {PRIORITY_LABELS[issue.priority]}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={2}>
        {issue.title}
      </Text>

      {/* Description */}
      {issue.description ? (
        <Text style={styles.description} numberOfLines={2}>{issue.description}</Text>
      ) : null}

      {/* Meta */}
      <View style={styles.metaRow}>
        {showProperty && issue.property && (
          <>
            <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{issue.property.name}</Text>
            <Text style={styles.dot}>·</Text>
          </>
        )}
        <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
        <Text style={styles.metaText}>{format(new Date(issue.created_at), 'MMM d, yyyy')}</Text>
        {issue.assignee && (
          <>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{issue.assignee.full_name}</Text>
          </>
        )}
      </View>

      {/* Resolution note (done) */}
      {isDone && issue.resolution_notes ? (
        <Text style={styles.resolutionNote} numberOfLines={2}>
          ✓ {issue.resolution_notes}
        </Text>
      ) : null}

      {/* Action buttons */}
      {status === 'open' && onSubmitCompletion && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#F39C12' }]}
          onPress={onSubmitCompletion}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={15} color="#fff" />
          <Text style={styles.actionBtnText}>Submit Completion Photo</Text>
        </TouchableOpacity>
      )}

      {isPending && onReviewClose && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#F39C12' }]}
          onPress={onReviewClose}
          activeOpacity={0.8}
        >
          <Ionicons name="eye" size={15} color="#fff" />
          <Text style={styles.actionBtnText}>Review &amp; Close Issue</Text>
        </TouchableOpacity>
      )}

      {isDone && onReopen && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.textMuted }]}
          onPress={onReopen}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={15} color="#fff" />
          <Text style={styles.actionBtnText}>Reopen</Text>
        </TouchableOpacity>
      )}
    </Container>
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
  cardDone: { opacity: 0.72 },
  topRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  priorityPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: { ...Typography.body, fontWeight: '600', marginBottom: 4 },
  titleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  description: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { ...Typography.caption },
  dot: { color: Colors.textMuted, fontSize: 12 },
  resolutionNote: {
    ...Typography.caption,
    color: Colors.success,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
