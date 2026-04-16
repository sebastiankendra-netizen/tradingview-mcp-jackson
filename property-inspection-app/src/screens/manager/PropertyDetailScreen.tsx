import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { CONDITION_COLORS, CONDITION_LABELS } from '../../data/checklist';
import IssueCard from '../../components/IssueCard';
import { Inspection, MaintenanceIssue, ManagerStackParamList, Profile, Property } from '../../types';

type Route = RouteProp<ManagerStackParamList, 'PropertyDetail'>;
type Nav = NativeStackNavigationProp<ManagerStackParamList>;

export default function PropertyDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { propertyId } = route.params;

  const { profile } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [assignedInspectors, setAssignedInspectors] = useState<Profile[]>([]);
  const [allInspectors, setAllInspectors] = useState<Profile[]>([]);
  const [inProgressInspectionId, setInProgressInspectionId] = useState<string | undefined>();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: prop }, { data: insp }, { data: iss }, { data: assignments }, { data: inspectors }] =
      await Promise.all([
        supabase.from('properties').select('*').eq('id', propertyId).single(),
        supabase
          .from('inspections')
          .select('*, inspector:profiles!inspections_inspector_id_fkey(id,full_name,role)')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('maintenance_issues')
          .select('*, assignee:profiles!maintenance_issues_assigned_to_fkey(id,full_name,role)')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('property_assignments')
          .select('inspector_id, profiles!property_assignments_inspector_id_fkey(id,full_name,role)')
          .eq('property_id', propertyId)
          .eq('is_active', true),
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'inspector'),
      ]);

    setProperty(prop ?? null);
    setInspections((insp ?? []) as Inspection[]);
    setIssues((iss ?? []) as MaintenanceIssue[]);
    setAllInspectors((inspectors ?? []) as Profile[]);

    const assigned = (assignments ?? [])
      .map((a: any) => a.profiles)
      .filter(Boolean) as Profile[];
    setAssignedInspectors(assigned);

    // Check if the current user has an in-progress inspection for this property
    const myInProgress = (insp ?? []).find(
      (i: any) => i.status === 'in_progress',
    );
    setInProgressInspectionId(myInProgress?.id);

    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function assignInspector(inspector: Profile) {
    setAssigning(true);
    const alreadyAssigned = assignedInspectors.some((i) => i.id === inspector.id);

    if (alreadyAssigned) {
      await supabase
        .from('property_assignments')
        .delete()
        .eq('property_id', propertyId)
        .eq('inspector_id', inspector.id);
      setAssignedInspectors((prev) => prev.filter((i) => i.id !== inspector.id));
    } else {
      await supabase.from('property_assignments').upsert({
        property_id: propertyId,
        inspector_id: inspector.id,
        frequency: 'monthly',
        is_active: true,
      }, { onConflict: 'property_id,inspector_id' });
      setAssignedInspectors((prev) => [...prev, inspector]);
    }
    setAssigning(false);
  }

  async function startInspection() {
    if (!profile) return;

    if (inProgressInspectionId) {
      navigation.navigate('ConductInspection', {
        propertyId,
        inspectionId: inProgressInspectionId,
      });
      return;
    }

    Alert.alert(
      'Start Inspection',
      `Start a new inspection for ${property?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            const { data, error } = await supabase
              .from('inspections')
              .insert({ property_id: propertyId, inspector_id: profile.id, status: 'in_progress' })
              .select()
              .single();
            if (error || !data) {
              Alert.alert('Error', error?.message ?? 'Could not create inspection.');
              return;
            }
            setInProgressInspectionId(data.id);
            navigation.navigate('ConductInspection', { propertyId, inspectionId: data.id });
          },
        },
      ],
    );
  }

  function goToIssuesForReview() {
    navigation.navigate('AllIssues');
  }

  async function deleteProperty() {
    Alert.alert(
      'Delete Property',
      `Are you sure you want to delete "${property?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('properties').delete().eq('id', propertyId);
            navigation.goBack();
          },
        },
      ],
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
  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'pending_review');
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
            {/* VERSION BANNER - remove after confirming update */}
            <View style={{ backgroundColor: '#FF0000', padding: 12, margin: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center', fontSize: 16 }}>
                ✅ NEW CODE LOADED — Tap issues below to manage
              </Text>
            </View>

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
                  <Text style={styles.summaryValue}>{latestInspection?.condition_score ?? '—'}</Text>
                  <Text style={styles.summaryLabel}>Last Score</Text>
                </View>
              </View>

              {/* Start / Resume inspection button */}
              <TouchableOpacity
                style={[styles.inspectBtn, inProgressInspectionId && styles.inspectBtnResume]}
                onPress={startInspection}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={inProgressInspectionId ? 'play-circle' : 'clipboard'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.inspectBtnText}>
                  {inProgressInspectionId ? 'Resume Inspection' : 'Start Inspection'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Assigned inspectors */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Assigned Inspectors</Text>
                <TouchableOpacity
                  style={styles.assignBtn}
                  onPress={() => setShowAssignModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add" size={14} color="#fff" />
                  <Text style={styles.assignBtnText}>Assign</Text>
                </TouchableOpacity>
              </View>
              {assignedInspectors.length === 0 ? (
                <Text style={styles.noAssigned}>No inspectors assigned yet.</Text>
              ) : (
                assignedInspectors.map((inspector) => (
                  <View key={inspector.id} style={styles.inspectorPill}>
                    <Ionicons name="person-circle-outline" size={18} color={Colors.primary} />
                    <Text style={styles.inspectorName}>{inspector.full_name}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Active issues (open + pending review) */}
            {openIssues.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Issues ({openIssues.length})</Text>
                {openIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onPress={goToIssuesForReview}
                    onReviewClose={issue.status === 'pending_review' ? goToIssuesForReview : undefined}
                  />
                ))}
              </View>
            )}

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
                <IssueCard key={issue.id} issue={issue} onPress={goToIssuesForReview} />
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

      {/* Assign Inspector Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide" onRequestClose={() => setShowAssignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Assign Inspectors</Text>
            <Text style={styles.modalSub}>Tap to assign or remove</Text>

            {allInspectors.length === 0 ? (
              <View style={styles.noInspectorsBox}>
                <Ionicons name="person-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.noInspectorsText}>No inspector accounts found.</Text>
                <Text style={styles.noInspectorsHint}>
                  Go to Supabase → Authentication → Add user, then set their role to "inspector" in the profiles table.
                </Text>
              </View>
            ) : (
              allInspectors.map((inspector) => {
                const assigned = assignedInspectors.some((i) => i.id === inspector.id);
                return (
                  <TouchableOpacity
                    key={inspector.id}
                    style={[styles.inspectorRow, assigned && styles.inspectorRowAssigned]}
                    onPress={() => assignInspector(inspector)}
                    disabled={assigning}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={assigned ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={assigned ? Colors.success : Colors.textMuted}
                    />
                    <Text style={[styles.inspectorRowName, assigned && { color: Colors.success }]}>
                      {inspector.full_name}
                    </Text>
                    {assigned && (
                      <Text style={styles.assignedBadge}>Assigned</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowAssignModal(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  infoCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.card },
  infoRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  iconCircle: { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  propName: { ...Typography.h2, marginBottom: 4 },
  propAddress: { ...Typography.bodySmall },
  summaryRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  summaryValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  summaryLabel: { ...Typography.caption, marginTop: 2 },
  inspectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, height: 48, marginTop: Spacing.md },
  inspectBtnResume: { backgroundColor: Colors.accent },
  inspectBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.sm, paddingVertical: 10 },
  deleteBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  section: { marginBottom: Spacing.md },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.h3 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  assignBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noAssigned: { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic' },
  inspectorPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  inspectorName: { ...Typography.body, color: Colors.primary },
  inspRow: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: 6, ...Shadow.card },
  inspLeft: { flex: 1 },
  inspDate: { ...Typography.body, fontWeight: '600' },
  inspBy: { ...Typography.bodySmall },
  scorePill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  scoreText: { fontSize: 12, fontWeight: '700' },
  pendingPill: { backgroundColor: Colors.accent + '20', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  pendingText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { ...Typography.bodySmall, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitle: { ...Typography.h2, marginBottom: 4 },
  modalSub: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.md },
  inspectorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, marginBottom: 4, backgroundColor: Colors.background },
  inspectorRowAssigned: { backgroundColor: Colors.success + '10' },
  inspectorRowName: { ...Typography.body, flex: 1 },
  assignedBadge: { fontSize: 11, fontWeight: '700', color: Colors.success },
  noInspectorsBox: { alignItems: 'center', padding: Spacing.lg, gap: Spacing.sm },
  noInspectorsText: { ...Typography.h3, color: Colors.textSecondary },
  noInspectorsHint: { ...Typography.bodySmall, textAlign: 'center', color: Colors.textMuted },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
