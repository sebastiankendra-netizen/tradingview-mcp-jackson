import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getSignedUrl, supabase, uploadPhoto } from '../../lib/supabase';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import IssueCard from '../../components/IssueCard';
import {
  IssuePhoto,
  IssuePriority,
  IssueStatus,
  MaintenanceIssue,
  ManagerStackParamList,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from '../../types';

type Nav = NativeStackNavigationProp<ManagerStackParamList>;

type Filter = 'open' | 'pending_review' | 'done' | 'all';
type PriorityFilter = 'all' | IssuePriority;

const FILTER_CONFIG: Record<Filter, { label: string; color: string }> = {
  open:           { label: 'Open',         color: Colors.danger },
  pending_review: { label: 'Needs Review', color: '#F39C12' },
  done:           { label: 'Done',         color: Colors.success },
  all:            { label: 'All',          color: Colors.primary },
};

interface FilterBtnProps {
  value: Filter;
  count?: number;
  active: boolean;
  onPress: () => void;
}

function FilterBtn({ value, count, active, onPress }: FilterBtnProps) {
  const cfg = FILTER_CONFIG[value];
  return (
    <TouchableOpacity
      style={[styles.filterBtn, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{cfg.label}</Text>
      {count !== undefined && (
        <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function IssuesScreen() {
  const navigation = useNavigation<Nav>();
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [filter, setFilter] = useState<Filter>('pending_review');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Review & Close modal state
  const [reviewIssue, setReviewIssue] = useState<MaintenanceIssue | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('maintenance_issues')
      .select(`
        *,
        property:properties(id,name,address),
        assignee:profiles!maintenance_issues_assigned_to_fkey(id,full_name,role),
        photos:issue_photos(*)
      `)
      .order('created_at', { ascending: false });
    setIssues((data ?? []) as MaintenanceIssue[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleAddPhoto() {
    Alert.alert('Add Completion Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Camera Permission Required'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
          if (!result.canceled) setNewPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission Required'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
          if (!result.canceled) setNewPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function openReview(issue: MaintenanceIssue) {
    setReviewIssue(issue);
    setAfterUrl(null);
    setNewPhotoUri(null);
    setResolutionNote('');

    const photos = (issue.photos ?? []) as IssuePhoto[];
    const afterPhoto = photos.find((p) => p.photo_type === 'after');

    if (afterPhoto) {
      setLoadingPhotos(true);
      const url = await getSignedUrl('inspection-photos', afterPhoto.storage_path);
      setAfterUrl(url);
      setLoadingPhotos(false);
    }
  }

  async function closeIssue() {
    if (!reviewIssue) return;

    // A completion photo must exist — either submitted by the tech or added by the manager
    if (!afterUrl && !newPhotoUri) {
      Alert.alert(
        'Photo Required',
        'A completion photo is required before closing this issue. The maintenance tech must submit one, or you can add a photo here.',
      );
      return;
    }

    setClosing(true);

    // Upload manager's photo if they added one
    if (newPhotoUri) {
      try {
        const ext = newPhotoUri.split('.').pop() ?? 'jpg';
        const fileName = `completion_${Date.now()}.${ext}`;
        const storagePath = `issues/${reviewIssue.id}/${fileName}`;
        await uploadPhoto('inspection-photos', storagePath, newPhotoUri);
        await supabase.from('issue_photos').insert({
          issue_id: reviewIssue.id,
          storage_path: storagePath,
          file_name: fileName,
          photo_type: 'after',
        });
      } catch {
        Alert.alert('Photo Upload Failed', 'Issue will still be closed.');
      }
    }

    const { error } = await supabase
      .from('maintenance_issues')
      .update({
        status: 'done',
        resolution_notes: resolutionNote.trim() || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reviewIssue.id);

    if (error) {
      Alert.alert('Error', error.message);
      setClosing(false);
      return;
    }

    setIssues((prev) =>
      prev.map((i) =>
        i.id === reviewIssue.id
          ? { ...i, status: 'done' as IssueStatus, resolution_notes: resolutionNote.trim() || undefined }
          : i,
      ),
    );
    setClosing(false);
    setReviewIssue(null);
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
            prev.map((i) => (i.id === issue.id ? { ...i, status: 'open' as IssueStatus } : i)),
          );
        },
      },
    ]);
  }

  const filtered = issues.filter((i) => {
    const statusMatch = filter === 'all' || i.status === filter;
    const priorityMatch = priorityFilter === 'all' || i.priority === priorityFilter;
    return statusMatch && priorityMatch;
  });

  const openCount = issues.filter((i) => i.status === 'open').length;
  const pendingCount = issues.filter((i) => i.status === 'pending_review').length;
  const doneCount = issues.filter((i) => i.status === 'done').length;

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterBtn value="pending_review" count={pendingCount} active={filter === 'pending_review'} onPress={() => setFilter('pending_review')} />
        <FilterBtn value="open" count={openCount} active={filter === 'open'} onPress={() => setFilter('open')} />
        <FilterBtn value="done" count={doneCount} active={filter === 'done'} onPress={() => setFilter('done')} />
        <FilterBtn value="all" count={issues.length} active={filter === 'all'} onPress={() => setFilter('all')} />
      </ScrollView>

      {/* Priority filter chips */}
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={filter === 'pending_review' ? 'time-outline' : filter === 'open' ? 'checkmark-circle-outline' : 'documents-outline'}
              size={48}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'pending_review' ? 'Nothing to review'
                : filter === 'open' ? 'No open issues'
                : 'No issues found'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'pending_review' ? 'Completed work will show up here for your approval.'
                : filter === 'open' ? 'All clear across your properties.'
                : ''}
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <IssueCard
              key={item.id}
              issue={item}
              showProperty
              onPress={() => openReview(item)}
              onReviewClose={() => openReview(item)}
              onReopen={() => reopenIssue(item)}
            />
          ))
        )}
      </ScrollView>

      {/* Review & Close Modal */}
      <Modal
        visible={reviewIssue !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewIssue(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Review & Close</Text>
              <Text style={styles.modalIssueTitle}>{reviewIssue?.title}</Text>
              {reviewIssue?.property && (
                <Text style={styles.modalProp}>
                  {(reviewIssue.property as any).name}
                </Text>
              )}

              {loadingPhotos ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
              ) : (
                <View style={styles.photoBlock}>
                  <View style={styles.photoCaptionRow}>
                    <Text style={styles.photoCaption}>Completion Photo</Text>
                    {!afterUrl && !newPhotoUri && (
                      <View style={styles.photoRequiredBadge}>
                        <Ionicons name="alert-circle" size={12} color={Colors.danger} />
                        <Text style={styles.photoRequiredBadgeText}>Required</Text>
                      </View>
                    )}
                    {(afterUrl || newPhotoUri) && (
                      <View style={styles.photoOkBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                        <Text style={styles.photoOkBadgeText}>Photo added</Text>
                      </View>
                    )}
                  </View>
                  {/* Show new photo if manager took one, else show submitted photo */}
                  {newPhotoUri ? (
                    <View>
                      <Image source={{ uri: newPhotoUri }} style={styles.photoImageFull} resizeMode="cover" />
                      <TouchableOpacity style={styles.replacePhotoBtn} onPress={() => setNewPhotoUri(null)}>
                        <Ionicons name="close-circle" size={26} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : afterUrl ? (
                    <Image source={{ uri: afterUrl }} style={styles.photoImageFull} resizeMode="cover" />
                  ) : (
                    <View style={[styles.photoImageFull, styles.noPhoto]}>
                      <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
                      <Text style={styles.noPhotoText}>No completion photo yet</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                    <Text style={styles.addPhotoBtnText}>
                      {newPhotoUri || afterUrl ? 'Replace Photo' : 'Add Completion Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.modalLabel}>Resolution Note (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Approve or add a note about how the issue was fixed..."
                placeholderTextColor={Colors.textMuted}
                value={resolutionNote}
                onChangeText={setResolutionNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.closeBtn, (closing || (!afterUrl && !newPhotoUri)) && styles.closeBtnDisabled]}
                onPress={closeIssue}
                disabled={closing || (!afterUrl && !newPhotoUri)}
                activeOpacity={0.85}
              >
                {closing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.closeBtnText}>Close Issue</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReviewIssue(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  filterRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
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
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '90%',
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
  photoBlock: { marginBottom: Spacing.md },
  photoCaptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  photoCaption: { ...Typography.label },
  photoRequiredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.danger + '15', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  photoRequiredBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  photoOkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '15', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  photoOkBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  photoImageFull: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  noPhotoText: { ...Typography.caption, color: Colors.textMuted },
  replacePhotoBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 13 },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  addPhotoBtnText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  modalLabel: { ...Typography.label, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 70,
    marginBottom: Spacing.md,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    height: 52,
  },
  closeBtnDisabled: { backgroundColor: Colors.textMuted },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { ...Typography.body, color: Colors.textSecondary },
});
