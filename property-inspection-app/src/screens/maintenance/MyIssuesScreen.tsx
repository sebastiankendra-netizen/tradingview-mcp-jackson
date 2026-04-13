import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { MaintenanceIssue } from '../../types';

export default function MyIssuesScreen() {
  const { profile, signOut } = useAuth();
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<MaintenanceIssue | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('maintenance_issues')
      .select(`
        *,
        property:properties(id,name,address,city)
      `)
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false });
    setIssues((data ?? []) as MaintenanceIssue[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function markDone(issue: MaintenanceIssue) {
    setResolving(true);
    await supabase
      .from('maintenance_issues')
      .update({
        status: 'done',
        resolution_notes: resolutionNote.trim() || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', issue.id);

    setIssues((prev) =>
      prev.map((i) =>
        i.id === issue.id
          ? { ...i, status: 'done', resolution_notes: resolutionNote.trim() || undefined }
          : i,
      ),
    );
    setResolving(false);
    setSelected(null);
    setResolutionNote('');
  }

  async function reopenIssue(issue: MaintenanceIssue) {
    Alert.alert('Reopen Issue', 'Mark this issue as open again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: async () => {
          await supabase
            .from('maintenance_issues')
            .update({ status: 'open', resolved_at: null, resolution_notes: null })
            .eq('id', issue.id);
          setIssues((prev) =>
            prev.map((i) => (i.id === issue.id ? { ...i, status: 'open' } : i)),
          );
        },
      },
    ]);
  }

  const openIssues = issues.filter((i) => i.status === 'open');
  const doneIssues = issues.filter((i) => i.status === 'done');
  const displayList = showDone ? doneIssues : openIssues;

  const IssueRow = ({ item }: { item: MaintenanceIssue }) => {
    const isOpen = item.status === 'open';
    return (
      <TouchableOpacity
        style={[styles.issueCard, !isOpen && styles.issueCardDone]}
        onPress={() => isOpen ? setSelected(item) : reopenIssue(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.statusDot, { backgroundColor: isOpen ? Colors.danger : Colors.success }]} />
        <View style={styles.issueBody}>
          <Text style={[styles.issueTitle, !isOpen && styles.issueTitleDone]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {(item.property as any)?.name ?? 'Unknown property'}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {format(new Date(item.created_at), 'MMM d')}
            </Text>
          </View>
          {!isOpen && item.resolution_notes && (
            <Text style={styles.resolvedNote} numberOfLines={1}>
              Note: {item.resolution_notes}
            </Text>
          )}
        </View>
        <Ionicons
          name={isOpen ? 'checkmark-circle-outline' : 'refresh-circle-outline'}
          size={22}
          color={isOpen ? Colors.success : Colors.textMuted}
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{profile?.full_name ?? 'Tech'}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !showDone && styles.toggleBtnActive]}
          onPress={() => setShowDone(false)}
        >
          <Text style={[styles.toggleLabel, !showDone && styles.toggleLabelActive]}>
            Open ({openIssues.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, showDone && styles.toggleBtnActive]}
          onPress={() => setShowDone(true)}
        >
          <Text style={[styles.toggleLabel, showDone && styles.toggleLabelActive]}>
            Completed ({doneIssues.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayList}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <IssueRow item={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={showDone ? 'checkmark-circle-outline' : 'clipboard-outline'}
              size={48}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {showDone ? 'No completed issues' : 'No open issues'}
            </Text>
            <Text style={styles.emptyText}>
              {showDone ? '' : "You're all caught up!"}
            </Text>
          </View>
        }
      />

      {/* Mark Done modal */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Mark as Done</Text>
            <Text style={styles.modalIssueTitle} numberOfLines={3}>
              {selected?.title}
            </Text>
            <Text style={styles.modalProp}>
              {(selected?.property as any)?.name ?? ''}
            </Text>

            <Text style={styles.modalLabel}>Resolution Note (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What was done to resolve this?"
              placeholderTextColor={Colors.textMuted}
              value={resolutionNote}
              onChangeText={setResolutionNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.doneBtn, resolving && { opacity: 0.7 }]}
              onPress={() => selected && markDone(selected)}
              disabled={resolving}
              activeOpacity={0.85}
            >
              {resolving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.doneBtnText}>Mark as Done</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setSelected(null); setResolutionNote(''); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  greeting: { ...Typography.bodySmall, color: Colors.textSecondary },
  name: { ...Typography.h2 },
  logoutBtn: { padding: 8 },
  toggleRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  toggleBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  toggleBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  toggleLabel: { ...Typography.label, color: Colors.textSecondary },
  toggleLabelActive: { color: Colors.primary },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xxl },
  issueCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadow.card,
  },
  issueCardDone: { opacity: 0.7 },
  statusDot: { width: 10, height: 10, borderRadius: Radius.full },
  issueBody: { flex: 1 },
  issueTitle: { ...Typography.body, fontWeight: '600', marginBottom: 4 },
  issueTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption },
  dot: { color: Colors.textMuted, fontSize: 12 },
  resolvedNote: { ...Typography.caption, color: Colors.success, marginTop: 2, fontStyle: 'italic' },
  emptyState: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { ...Typography.h2, marginBottom: Spacing.sm },
  modalIssueTitle: { ...Typography.body, fontWeight: '600', marginBottom: 4 },
  modalProp: { ...Typography.bodySmall, color: Colors.primary, marginBottom: Spacing.md },
  modalLabel: { ...Typography.label, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 80,
    marginBottom: Spacing.md,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    height: 52,
    marginBottom: Spacing.sm,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { ...Typography.body, color: Colors.textSecondary },
});
