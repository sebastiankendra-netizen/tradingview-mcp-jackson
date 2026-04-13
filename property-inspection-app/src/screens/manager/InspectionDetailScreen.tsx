import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase, getSignedUrl } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { CHECKLIST_CATEGORIES, CONDITION_COLORS, CONDITION_LABELS } from '../../data/checklist';
import ConditionStars from '../../components/ConditionStars';
import PhotoGallery from '../../components/PhotoGallery';
import ChecklistItemRow from '../../components/ChecklistItemRow';
import { ChecklistItem, Inspection, ManagerStackParamList } from '../../types';

type Route = RouteProp<ManagerStackParamList, 'InspectionDetail'>;

export default function InspectionDetailScreen() {
  const route = useRoute<Route>();
  const { inspectionId } = route.params;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: insp }, { data: items }] = await Promise.all([
      supabase
        .from('inspections')
        .select('*, property:properties(*), inspector:profiles!inspections_inspector_id_fkey(*)')
        .eq('id', inspectionId)
        .single(),
      supabase
        .from('checklist_items')
        .select('*, photos:item_photos(*)')
        .eq('inspection_id', inspectionId)
        .order('sort_order'),
    ]);

    // Resolve signed URLs for photos
    if (items) {
      for (const item of items) {
        if (item.photos) {
          for (const photo of item.photos) {
            photo.publicUrl = await getSignedUrl('inspection-photos', photo.storage_path) ?? undefined;
          }
        }
      }
    }

    setInspection(insp as Inspection ?? null);
    setChecklistItems((items ?? []) as ChecklistItem[]);
    setLoading(false);
  }, [inspectionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!inspection) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={Typography.body}>Inspection not found.</Text>
      </SafeAreaView>
    );
  }

  const passCount = checklistItems.filter((i) => i.status === 'pass').length;
  const failCount = checklistItems.filter((i) => i.status === 'fail').length;
  const naCount = checklistItems.filter((i) => i.status === 'na').length;
  const pendingCount = checklistItems.filter((i) => i.status === 'pending').length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.propName}>
                {(inspection.property as any)?.name ?? 'Property'}
              </Text>
              <Text style={styles.propAddress}>
                {(inspection.property as any)?.address}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  {(inspection.inspector as any)?.full_name ?? 'Unknown'}
                </Text>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>
                  {format(
                    new Date(inspection.submitted_at ?? inspection.created_at),
                    'MMM d, yyyy h:mm a',
                  )}
                </Text>
              </View>
            </View>

            {/* Status pill */}
            <View style={[
              styles.statusPill,
              inspection.status === 'submitted' ? styles.pillSubmitted : styles.pillInProgress,
            ]}>
              <Text style={[
                styles.statusText,
                inspection.status === 'submitted' ? styles.textSubmitted : styles.textInProgress,
              ]}>
                {inspection.status === 'submitted' ? 'Submitted' : 'In Progress'}
              </Text>
            </View>
          </View>

          {/* Condition score */}
          <View style={styles.scoreSection}>
            <Text style={styles.scoreSectionTitle}>Overall Condition</Text>
            <ConditionStars value={inspection.condition_score} readonly size="lg" />
          </View>

          {/* Checklist summary */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, { backgroundColor: Colors.passGreen }]}>
              <Text style={[styles.summaryCount, { color: Colors.success }]}>{passCount}</Text>
              <Text style={styles.summaryLabel}>Pass</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: Colors.failRed }]}>
              <Text style={[styles.summaryCount, { color: Colors.danger }]}>{failCount}</Text>
              <Text style={styles.summaryLabel}>Fail</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: Colors.naGray }]}>
              <Text style={[styles.summaryCount, { color: Colors.textSecondary }]}>{naCount}</Text>
              <Text style={styles.summaryLabel}>N/A</Text>
            </View>
            {pendingCount > 0 && (
              <View style={[styles.summaryItem, { backgroundColor: Colors.accent + '20' }]}>
                <Text style={[styles.summaryCount, { color: Colors.accent }]}>{pendingCount}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {inspection.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Inspector Notes</Text>
            <Text style={styles.notesBody}>{inspection.notes}</Text>
          </View>
        ) : null}

        {/* Checklist by category */}
        {CHECKLIST_CATEGORIES.map((cat) => {
          const catItems = checklistItems.filter((i) => i.category === cat.name);
          if (catItems.length === 0) return null;
          return (
            <View key={cat.name} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{cat.name}</Text>
              {catItems.map((item) => (
                <View key={item.id}>
                  <ChecklistItemRow
                    itemName={item.item_name}
                    status={item.status}
                    notes={item.notes}
                    photoCount={item.photos?.length ?? 0}
                    onChange={() => {}}
                    onAddPhoto={() => {}}
                    disabled
                  />
                  {/* Show photos if any */}
                  {item.photos && item.photos.length > 0 && (
                    <PhotoGallery
                      photos={item.photos.map((p) => ({ uri: p.publicUrl ?? p.storage_path, id: p.id }))}
                      readonly
                    />
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  propName: { ...Typography.h2, marginBottom: 2 },
  propAddress: { ...Typography.bodySmall, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption },
  dot: { color: Colors.textMuted, fontSize: 12 },
  statusPill: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  pillSubmitted: { backgroundColor: Colors.success + '20' },
  pillInProgress: { backgroundColor: Colors.accent + '20' },
  statusText: { fontSize: 12, fontWeight: '700' },
  textSubmitted: { color: Colors.success },
  textInProgress: { color: Colors.accent },
  scoreSection: { alignItems: 'center', paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  scoreSectionTitle: { ...Typography.label },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  summaryItem: { flex: 1, borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { ...Typography.caption, marginTop: 2 },
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    ...Shadow.card,
  },
  notesTitle: { ...Typography.label, marginBottom: 4 },
  notesBody: { ...Typography.body },
  categorySection: { marginBottom: Spacing.md },
  categoryTitle: { ...Typography.h3, marginBottom: Spacing.sm, color: Colors.primary },
});
