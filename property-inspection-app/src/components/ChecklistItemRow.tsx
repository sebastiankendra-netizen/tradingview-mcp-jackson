import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../lib/theme';
import { ChecklistStatus } from '../types';

interface Props {
  itemName: string;
  status: ChecklistStatus;
  notes?: string;
  photoCount?: number;
  onChange: (status: ChecklistStatus, notes: string) => void;
  onAddPhoto: () => void;
  disabled?: boolean;
  photoRequired?: boolean;
}

const STATUS_OPTIONS: { key: ChecklistStatus; label: string; color: string; bg: string }[] = [
  { key: 'pass', label: 'Pass', color: Colors.success, bg: Colors.passGreen },
  { key: 'fail', label: 'Fail', color: Colors.danger, bg: Colors.failRed },
  { key: 'na', label: 'N/A', color: Colors.textSecondary, bg: Colors.naGray },
];

export default function ChecklistItemRow({
  itemName,
  status,
  notes = '',
  photoCount = 0,
  onChange,
  onAddPhoto,
  disabled = false,
  photoRequired = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);

  function handleStatusPress(s: ChecklistStatus) {
    if (disabled) return;
    const newExpanded = s === 'fail';
    setExpanded(newExpanded || expanded);
    onChange(s, localNotes);
  }

  function handleNotesBlur() {
    onChange(status, localNotes);
  }

  return (
    <View style={styles.container}>
      {/* Row header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.itemName} numberOfLines={expanded ? undefined : 1}>
          {itemName}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {/* Status buttons */}
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((opt) => {
          const active = status === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.statusBtn,
                active && { backgroundColor: opt.bg, borderColor: opt.color },
              ]}
              onPress={() => handleStatusPress(opt.key)}
              disabled={disabled}
              activeOpacity={0.8}
            >
              {active && (
                <Ionicons
                  name={opt.key === 'pass' ? 'checkmark-circle' : opt.key === 'fail' ? 'close-circle' : 'remove-circle'}
                  size={14}
                  color={opt.color}
                />
              )}
              <Text
                style={[
                  styles.statusLabel,
                  active && { color: opt.color, fontWeight: '700' },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Photo button */}
        <TouchableOpacity
          style={[styles.photoBtn, photoRequired && styles.photoBtnRequired]}
          onPress={onAddPhoto}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons
            name="camera"
            size={16}
            color={photoRequired ? Colors.danger : photoCount > 0 ? Colors.success : Colors.primary}
          />
          {photoRequired && (
            <Text style={styles.photoRequiredLabel}>Required</Text>
          )}
          {photoCount > 0 && (
            <View style={[styles.photoBadge, { backgroundColor: Colors.success }]}>
              <Text style={styles.photoBadgeText}>{photoCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Expandable notes */}
      {expanded && !disabled && (
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            placeholder="Add a note about this item..."
            placeholderTextColor={Colors.textMuted}
            value={localNotes}
            onChangeText={setLocalNotes}
            onBlur={handleNotesBlur}
            multiline
            numberOfLines={3}
          />
        </View>
      )}
      {expanded && disabled && localNotes ? (
        <View style={styles.notesContainer}>
          <Text style={styles.notesReadonly}>{localNotes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
    gap: 8,
  },
  itemName: {
    flex: 1,
    ...Typography.body,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.background,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  photoBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  photoBtnRequired: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + '10',
  },
  photoRequiredLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
  },
  photoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: Radius.full,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  notesContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  notesInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  notesReadonly: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});
