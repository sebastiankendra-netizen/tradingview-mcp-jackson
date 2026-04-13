import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { CONDITION_COLORS, CONDITION_LABELS } from '../../data/checklist';
import IssueCard from '../../components/IssueCard';
import { Inspection, MaintenanceIssue, ManagerStackParamList, Property } from '../../types';

type Route = RouteProp<ManagerStackParamList, 'PropertyDetail'>;
type Nav = NativeStackNavigationProp<ManagerStackParamList>;

export default function PropertyDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { propertyId } = route.params;

  const [property, setProperty] = useState<Property | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: prop }, { data: insp }, { data: iss }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', propertyId).single(),
      supabase
        .from('inspections')
        .select('*, inspector:profiles(id,full_name,role)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('maintenance_issues')
        .select('*, assignee:profiles!maintenance_issues_assigned_to_fkey(id,full_name,role)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false }),
    ]);

    setProperty(prop ?? null);
    setInspections((insp ?? []) as Inspection[]);
    setIssues((iss ?? []) as MaintenanceIssue[]);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function toggleIssueStatus(issue: MaintenanceIssue) {
    const newStatus = issue.status === 'open' ? 'done' : 'open';
    await supabase
      .from('maintenance_issues')
      .update({
        status: newStatus,
        resolved_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', issue.id);
    setIssues((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus } : i)),
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={Typography.body}>Property not found.</Text>
      </SafeAreaView>
    );
  }

  const latestInspection = inspections[0];
  const openIssues = issues.filter((i) => i.status === 'open');
  const doneIssues = issues.filter((i) => i.status === 'done');

  const InspectionRow = ({ item }: { item: Inspection }) => {
    const score = item.condition_score;
    const scoreColor = score ? CONDITION_COLORS[score] : Colors.textMuted;
    return (
      <TouchableOpacity
        style={styles.inspRow}
        onPress={() => navigation.navigate('InspectionDetail', { inspectionId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.inspLeft}>
          <Text style={styles.inspDate}>
            {format(new Date(item.submitted_at ?? item.created_at), 'MMM d, yyyy')}
          </Text>
          <Text style={styles.inspBy}>
            {(item.inspector as any)?.full_name ?? 'Unknown inspector'}
          </Text>
        </View>
        {score ? (
          <View style={[styles.scorePill, { backgroundColor: scoreColor + '20' }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {score}/5 · {CONDITION_LABELS[score]}
            </Text>
          </View>
        ) : (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>In Progress</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={inspections}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Property info card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="business" size={28} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{property.name}</Text>
                  <Text style={styles.propAddress}>
                    {property.address}, {property.city}, {property.state}
                    {property.zip ? ` ${property.zip}` : ''}
                  </Text>
                </View>
              </View>

              {/* Summary row */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{inspections.length}</Text>
                  <Text style={styles.summaryLabel}>Inspections</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, openIssues.length > 0 && { color: Colors.danger }]}>
                    {openIssues.length}
                  </Text>
                  <Text style={styles.summaryLabel}>Open Issues</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {latestInspection?.condition_score ?? '—'}
                  </Text>
                  <Text style={styles.summaryLabel}>Last Score</Text>
                </View>
              </View>
            </View>

            {/* Open issues section */}
            {openIssues.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Open Issues ({openIssues.length})
                </Text>
                {openIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onToggleStatus={() => toggleIssueStatus(issue)}
                  />
                ))}
              </View>
            )}

            {/* Inspection history header */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Inspection History</Text>
            </View>
          </>
        }
        renderItem={({ item }) => <InspectionRow item={item} />}
        ListFooterComponent={
          doneIssues.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resolved Issues ({doneIssues.length})</Text>
              {doneIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onToggleStatus={() => toggleIssueStatus(issue)}
                />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No inspections yet.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  infoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propName: { ...Typography.h2, marginBottom: 4 },
  propAddress: { ...Typography.bodySmall },
  summaryRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  summaryValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  summaryLabel: { ...Typography.caption, marginTop: 2 },
  section: { marginBottom: Spacing.md },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  inspRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    ...Shadow.card,
  },
  inspLeft: { flex: 1 },
  inspDate: { ...Typography.body, fontWeight: '600' },
  inspBy: { ...Typography.bodySmall },
  scorePill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  scoreText: { fontSize: 12, fontWeight: '700' },
  pendingPill: {
    backgroundColor: Colors.accent + '20',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  pendingText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted },
});
