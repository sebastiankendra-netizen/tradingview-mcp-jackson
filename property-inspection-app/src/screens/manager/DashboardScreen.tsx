import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import PropertyCard from '../../components/PropertyCard';
import { ManagerStackParamList, Property } from '../../types';

type Nav = NativeStackNavigationProp<ManagerStackParamList>;

interface PropertyWithStats extends Property {
  lastInspectionDate?: string;
  conditionScore?: number;
  openIssuesCount: number;
}

interface Stats {
  totalProperties: number;
  inspectedThisMonth: number;
  openIssues: number;
  recentSubmissions: number;
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut } = useAuth();
  const [properties, setProperties] = useState<PropertyWithStats[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalProperties: 0,
    inspectedThisMonth: 0,
    openIssues: 0,
    recentSubmissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: propsData }, { data: issuesData }, { data: inspectionsData }] =
      await Promise.all([
        supabase.from('properties').select('*').order('name'),
        supabase.from('maintenance_issues').select('property_id, status'),
        supabase
          .from('inspections')
          .select('property_id, condition_score, submitted_at, created_at')
          .eq('status', 'submitted')
          .order('submitted_at', { ascending: false }),
      ]);

    if (!propsData) { setLoading(false); return; }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const enriched: PropertyWithStats[] = propsData.map((p) => {
      const propInspections = (inspectionsData ?? []).filter(
        (i) => i.property_id === p.id,
      );
      const latest = propInspections[0];
      const openCount = (issuesData ?? []).filter(
        (i) => i.property_id === p.id && (i.status === 'open' || i.status === 'pending_review'),
      ).length;

      return {
        ...p,
        lastInspectionDate: latest?.submitted_at ?? undefined,
        conditionScore: latest?.condition_score ?? undefined,
        openIssuesCount: openCount,
      };
    });

    const inspectedThisMonth = new Set(
      (inspectionsData ?? [])
        .filter((i) => i.submitted_at && new Date(i.submitted_at) >= startOfMonth)
        .map((i) => i.property_id),
    ).size;

    const openIssues = (issuesData ?? []).filter(
      (i) => i.status === 'open' || i.status === 'pending_review',
    ).length;
    const recentSubmissions = (inspectionsData ?? []).filter(
      (i) => i.submitted_at && new Date(i.submitted_at) >= startOfMonth,
    ).length;

    setProperties(enriched);
    setStats({
      totalProperties: propsData.length,
      inspectedThisMonth,
      openIssues,
      recentSubmissions,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const deleteProperty = useCallback((property: PropertyWithStats) => {
    Alert.alert(
      'Delete Property',
      `Are you sure you want to delete "${property.name}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => swipeableRefs.current.get(property.id)?.close(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('properties')
              .delete()
              .eq('id', property.id);

            if (error) {
              Alert.alert('Delete Failed', error.message);
              swipeableRefs.current.get(property.id)?.close();
              return;
            }

            setProperties((prev) => prev.filter((p) => p.id !== property.id));
            setStats((prev) => ({ ...prev, totalProperties: prev.totalProperties - 1 }));
          },
        },
      ],
    );
  }, []);

  const renderRightActions = useCallback((property: PropertyWithStats) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => deleteProperty(property)}
      activeOpacity={0.8}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  ), [deleteProperty]);

  const StatCard = ({ icon, value, label, color }: {
    icon: string; value: number; label: string; color: string;
  }) => (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={properties}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.topBar}>
              <Text style={styles.name}>{profile?.full_name ?? 'Manager'}</Text>
              <View style={styles.topActions}>
                <TouchableOpacity
                  style={styles.manualsBtn}
                  onPress={() => navigation.navigate('Tasks')}
                >
                  <Ionicons name="checkbox-outline" size={16} color="#fff" />
                  <Text style={styles.manualsBtnText}>Tasks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualsBtn}
                  onPress={() => navigation.navigate('AllIssues')}
                >
                  <Ionicons name="warning-outline" size={16} color="#fff" />
                  <Text style={styles.manualsBtnText}>
                    Issues{stats.openIssues > 0 ? ` (${stats.openIssues})` : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualsBtn}
                  onPress={() => navigation.navigate('Manuals')}
                >
                  <Ionicons name="book-outline" size={16} color="#fff" />
                  <Text style={styles.manualsBtnText}>Manuals</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date */}
            <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard icon="business" value={stats.totalProperties} label="Properties" color={Colors.primary} />
              <StatCard icon="shield-checkmark" value={stats.inspectedThisMonth} label="Inspected" color={Colors.success} />
              <StatCard icon="warning" value={stats.openIssues} label="Open Issues" color={Colors.danger} />
              <StatCard icon="documents" value={stats.recentSubmissions} label="Reports" color={Colors.accent} />
            </View>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Properties</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('AddProperty')}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Swipeable
            ref={(ref) => swipeableRefs.current.set(item.id, ref)}
            renderRightActions={() => renderRightActions(item)}
            friction={2}
            rightThreshold={60}
            overshootRight={false}
          >
            <PropertyCard
              property={item}
              lastInspectionDate={item.lastInspectionDate}
              conditionScore={item.conditionScore}
              openIssuesCount={item.openIssuesCount}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
            />
          </Swipeable>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No properties yet</Text>
            <Text style={styles.emptyText}>Tap "Add" to add your first property.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingTop: 0 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingBottom: 4,
  },
  greeting: { ...Typography.bodySmall, color: Colors.textSecondary },
  name: { ...Typography.h2 },
  topActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  manualsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  manualsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  iconBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dateText: { ...Typography.caption, color: Colors.textMuted, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderTopWidth: 3,
    ...Shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { ...Typography.caption, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { ...Typography.h3 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 4,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center' },
  manualsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  manualsIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualsRowTitle: { ...Typography.body, fontWeight: '600' },
  manualsRowSub: { ...Typography.caption, color: Colors.textMuted },
  deleteAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: Radius.md,
    marginBottom: 6,
    gap: 4,
  },
  deleteActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
