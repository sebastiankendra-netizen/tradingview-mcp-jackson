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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import IssueCard from '../../components/IssueCard';
import { IssuePriority, MaintenanceIssue, ManagerStackParamList, PRIORITY_COLORS, PRIORITY_LABELS } from '../../types';

type Nav = NativeStackNavigationProp<ManagerStackParamList>;

type Filter = 'open' | 'done' | 'all';
type PriorityFilter = 'all' | IssuePriority;

export default function IssuesScreen() {
  const navigation = useNavigation<Nav>();
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const query = supabase
      .from('maintenance_issues')
      .select(`
        *,
        property:properties(id,name,address),
        assignee:profiles!maintenance_issues_assigned_to_fkey(id,full_name,role)
      `)
      .order('created_at', { ascending: false });

    const { data } = await query;
    setIssues((data ?? []) as MaintenanceIssue[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function toggleStatus(issue: MaintenanceIssue) {
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

  const filtered = issues.filter((i) => {
    const statusMatch = filter === 'all' || i.status === filter;
    const priorityMatch = priorityFilter === 'all' || i.priority === priorityFilter;
    return statusMatch && priorityMatch;
  });

  const openCount = issues.filter((i) => i.status === 'open').length;
  const doneCount = issues.filter((i) => i.status === 'done').length;

  const FilterBtn = ({ value, label, count }: { value: Filter; label: string; count?: number }) => (
    <TouchableOpacity
      style={[styles.filterBtn, filter === value && styles.filterBtnActive]}
      onPress={() => setFilter(value)}
      activeOpacity={0.8}
    >
      <Text style={[styles.filterLabel, filter === value && styles.filterLabelActive]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.filterBadge, filter === value && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, filter === value && styles.filterBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddIssue')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      {/* Status filter tabs */}
      <View style={styles.filterRow}>
        <FilterBtn value="open" label="Open" count={openCount} />
        <FilterBtn value="done" label="Done" count={doneCount} />
        <FilterBtn value="all" label="All" count={issues.length} />
      </View>

      {/* Priority filter chips (only when viewing open issues) */}
      {filter !== 'done' && (
        <View style={styles.priorityRow}>
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => {
            const active = priorityFilter === p;
            const color = p === 'all' ? Colors.primary : PRIORITY_COLORS[p as IssuePriority];
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  active && { backgroundColor: color + '20', borderColor: color },
                ]}
                onPress={() => setPriorityFilter(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.priorityChipText, active && { color }]}>
                  {p === 'all' ? 'All Priority' : PRIORITY_LABELS[p as IssuePriority]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            showProperty
            onToggleStatus={() => toggleStatus(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={filter === 'open' ? 'checkmark-circle-outline' : 'documents-outline'}
              size={48}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'open' ? 'No open issues' : 'No issues found'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'open' ? 'All clear across your properties.' : ''}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  filterRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: { ...Typography.label, color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },
  filterBadge: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  filterBadgeTextActive: { color: '#fff' },
  priorityRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 6,
    flexWrap: 'wrap',
  },
  priorityChip: {
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
  },
  priorityChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  list: { padding: Spacing.md, paddingBottom: 100 },
  emptyState: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    zIndex: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
