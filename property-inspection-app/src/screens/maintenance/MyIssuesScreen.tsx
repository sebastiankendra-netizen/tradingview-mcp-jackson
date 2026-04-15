import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { supabase, uploadPhoto } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { IssueStatus, MaintenanceIssue } from '../../types';

type Tab = 'open' | 'pending' | 'done';

export default function MyIssuesScreen() {
  const { profile, signOut } = useAuth();
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('open');

  // Submit-completion modal state
  const [selected, setSelected] = useState<MaintenanceIssue | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('maintenance_issues')
      .select(`
        *,
        property:properties(id,name,address,city)
      `)
      .or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`)
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

  async function handleAddAfterPhoto() {
    Alert.alert('Add Completion Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Permission Required', 'Please allow camera access in Settings.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.75,
          });
          if (!result.canceled) setAfterPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libPerm.status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow photo library access.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.75,
          });
          if (!result.canceled) setAfterPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitCompletion() {
    if (!selected || !profile) return;
    if (!afterPhotoUri) {
      Alert.alert('Photo Required', 'Please attach a completion photo before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload after photo
      const ext = afterPhotoUri.split('.').pop() ?? 'jpg';
      const fileName = `after_${Date.now()}.${ext}`;
      const storagePath = `issues/${selected.id}/${fileName}`;
      await uploadPhoto('inspection-photos', storagePath, afterPhotoUri);
      await supabase.from('issue_photos').insert({
        issue_id: selected.id,
        uploaded_by: profile.id,
        storage_path: storagePath,
        file_name: fileName,
        photo_type: 'after',
      });

      // Update issue status → pending_review
      const { error } = await supabase
        .from('maintenance_issues')
        .update({
          status: 'pending_review',
          resolution_notes: resolutionNote.trim() || null,
        })
        .eq('id', selected.id);

      if (error) {
        Alert.alert('Error', error.message);
        setSubmitting(false);
        return;
      }

      setIssues((prev) =>
        prev.map((i) =>
          i.id === selected.id
            ? {
                ...i,
                status: 'pending_review' as IssueStatus,
                resolution_notes: resolutionNote.trim() || undefined,
              }
            : i,
        ),
      );
      setSelected(null);
      setResolutionNote('');
      setAfterPhotoUri(null);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Could not submit completion photo.');
    } finally {
      setSubmitting(false);
    }
  }

  const openList = issues.filter((i) => i.status === 'open');
  const pendingList = issues.filter((i) => i.status === 'pending_review');
  const doneList = issues.filter((i) => i.status === 'done');

  const displayList =
    tab === 'open' ? openList : tab === 'pending' ? pendingList : doneList;

  const IssueRow = ({ item }: { item: MaintenanceIssue }) => {
    const status = item.status as IssueStatus;
    const isOpen = status === 'open';
    const isPending = status === 'pending_review';

    return (
      <View style={[styles.issueCard, !isOpen && styles.issueCardDimmed]}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isOpen
                ? Colors.danger
                : isPending
                  ? '#F39C12'
                  : Colors.success,
            },
          ]}
        />
        <View style={styles.issueBody}>
          <Text style={styles.issueTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{(item.property as any)?.name ?? 'Unknown property'}</Text>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{format(new Date(item.created_at), 'MMM d')}</Text>
          </View>
          {isPending && (
            <Text style={styles.awaitingLabel}>⏳ Awaiting manager review</Text>
          )}
          {status === 'done' && item.resolution_notes && (
            <Text style={styles.resolvedNote} numberOfLines={1}>
              ✓ {item.resolution_notes}
            </Text>
          )}

          {isOpen && (
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setSelected(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={14} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Completion Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'open' && styles.tabBtnActiveOpen]}
          onPress={() => setTab('open')}
        >
          <Text style={[styles.tabLabel, tab === 'open' && { color: Colors.danger }]}>
            Open ({openList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'pending' && styles.tabBtnActivePending]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabLabel, tab === 'pending' && { color: '#F39C12' }]}>
            Pending ({pendingList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'done' && styles.tabBtnActiveDone]}
          onPress={() => setTab('done')}
        >
          <Text style={[styles.tabLabel, tab === 'done' && { color: Colors.success }]}>
            Done ({doneList.length})
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
              name={tab === 'done' ? 'checkmark-circle-outline' : tab === 'pending' ? 'time-outline' : 'clipboard-outline'}
              size={48}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {tab === 'done' ? 'No completed issues'
                : tab === 'pending' ? 'Nothing awaiting review'
                : 'No open issues'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'open' ? "You're all caught up!" : ''}
            </Text>
          </View>
        }
      />

      {/* Submit Completion modal */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setSelected(null); setAfterPhotoUri(null); setResolutionNote(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Submit Completion</Text>
              <Text style={styles.modalIssueTitle} numberOfLines={3}>{selected?.title}</Text>
              <Text style={styles.modalProp}>{(selected?.property as any)?.name ?? ''}</Text>

              <Text style={styles.modalLabel}>After Photo *</Text>
              <Text style={styles.modalHint}>
                A manager will review this photo before closing the issue.
              </Text>
              {afterPhotoUri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: afterPhotoUri }} style={styles.photoImage} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setAfterPhotoUri(null)}
                  >
                    <Ionicons name="close-circle" size={26} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={handleAddAfterPhoto}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                  <Text style={styles.photoBtnText}>Add After Photo</Text>
                </TouchableOpacity>
              )}

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
                style={[styles.doneBtn, submitting && { opacity: 0.7 }]}
                onPress={submitCompletion}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.doneBtnText}>Submit for Review</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setSelected(null); setAfterPhotoUri(null); setResolutionNote(''); }}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  greeting: { ...Typography.bodySmall, color: Colors.textSecondary },
  name: { ...Typography.h2 },
  logoutBtn: { padding: 8 },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  tabBtnActiveOpen: { borderColor: Colors.danger, backgroundColor: Colors.danger + '10' },
  tabBtnActivePending: { borderColor: '#F39C12', backgroundColor: '#F39C1215' },
  tabBtnActiveDone: { borderColor: Colors.success, backgroundColor: Colors.success + '10' },
  tabLabel: { ...Typography.label, color: Colors.textSecondary },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xxl },
  issueCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadow.card,
  },
  issueCardDimmed: { opacity: 0.85 },
  statusDot: { width: 10, height: 10, borderRadius: Radius.full, marginTop: 6 },
  issueBody: { flex: 1 },
  issueTitle: { ...Typography.body, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { ...Typography.caption },
  dot: { color: Colors.textMuted, fontSize: 12 },
  awaitingLabel: { ...Typography.caption, color: '#F39C12', marginTop: 4, fontWeight: '600' },
  resolvedNote: { ...Typography.caption, color: Colors.success, marginTop: 2, fontStyle: 'italic' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: '#F39C12',
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
    maxHeight: '92%',
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
  modalLabel: { ...Typography.label, marginBottom: 4, marginTop: Spacing.sm },
  modalHint: { ...Typography.caption, color: Colors.textMuted, marginBottom: 8 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    height: 60,
    marginBottom: Spacing.md,
  },
  photoBtnText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  photoPreview: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md },
  photoImage: { width: '100%', height: 200 },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 13,
  },
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
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F39C12',
    borderRadius: Radius.md,
    height: 52,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { ...Typography.body, color: Colors.textSecondary },
});
