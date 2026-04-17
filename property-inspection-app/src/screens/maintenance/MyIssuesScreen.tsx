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
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { supabase, uploadPhoto } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { IssueStatus, MaintenanceIssue, MaintenanceStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<MaintenanceStackParamList>;
type Tab = 'open' | 'pending' | 'done';

const STATUS_CONFIG: Record<IssueStatus, { color: string; label: string; icon: string }> = {
  open:           { color: Colors.danger,  label: 'Open',            icon: 'alert-circle'     },
  pending_review: { color: '#F39C12',      label: 'Awaiting Review', icon: 'time'             },
  done:           { color: Colors.success, label: 'Completed',       icon: 'checkmark-circle' },
};

interface IssueRowProps {
  item: MaintenanceIssue;
  onPress: (item: MaintenanceIssue) => void;
}

function IssueRow({ item, onPress }: IssueRowProps) {
  const cfg = STATUS_CONFIG[item.status as IssueStatus];
  return (
    <TouchableOpacity
      style={styles.issueCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.statusBar, { backgroundColor: cfg.color }]} />
      <View style={styles.issueBody}>
        <View style={[styles.pill, { backgroundColor: cfg.color + '18', borderColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.issueTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText}>{(item.property as any)?.name ?? 'Unknown property'}</Text>
          <Text style={styles.dot}>·</Text>
          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText}>{format(new Date(item.created_at), 'MMM d, yyyy')}</Text>
        </View>
        {item.status === 'open' && (
          <View style={styles.actionHint}>
            <Ionicons name="camera-outline" size={13} color={Colors.primary} />
            <Text style={styles.actionHintText}>Tap to submit completion photo</Text>
          </View>
        )}
        {item.status === 'pending_review' && (
          <View style={styles.actionHint}>
            <Ionicons name="hourglass-outline" size={13} color="#F39C12" />
            <Text style={[styles.actionHintText, { color: '#F39C12' }]}>Awaiting manager review</Text>
          </View>
        )}
        {item.status === 'done' && (
          <View style={styles.actionHint}>
            <Ionicons name="checkmark-circle-outline" size={13} color={Colors.success} />
            <Text style={[styles.actionHintText, { color: Colors.success }]}>Closed by manager</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={{ marginTop: 4, marginRight: 8 }} />
    </TouchableOpacity>
  );
}

export default function MyIssuesScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut } = useAuth();
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('open');

  const [selected, setSelected] = useState<MaintenanceIssue | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('maintenance_issues')
      .select('*, property:properties(id,name,address,city)')
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

  function closeModal() {
    setSelected(null);
    setAfterPhotoUri(null);
    setResolutionNote('');
  }

  const handleRowPress = useCallback((item: MaintenanceIssue) => {
    setSelected(item);
  }, []);

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
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
          if (!result.canceled) setAfterPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow photo library access.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
          if (!result.canceled) setAfterPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitCompletion() {
    if (!selected || !profile) return;
    if (!afterPhotoUri) {
      Alert.alert('Photo Required', 'You must attach a completion photo before submitting. This is required for accountability.');
      return;
    }
    setSubmitting(true);
    try {
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

      const { error } = await supabase
        .from('maintenance_issues')
        .update({ status: 'pending_review', resolution_notes: resolutionNote.trim() || null })
        .eq('id', selected.id);

      if (error) { Alert.alert('Error', error.message); setSubmitting(false); return; }

      setIssues((prev) =>
        prev.map((i) =>
          i.id === selected.id
            ? { ...i, status: 'pending_review' as IssueStatus, resolution_notes: resolutionNote.trim() || undefined }
            : i,
        ),
      );
      closeModal();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Could not submit completion photo.');
    } finally {
      setSubmitting(false);
    }
  }

  const openList    = issues.filter((i) => i.status === 'open');
  const pendingList = issues.filter((i) => i.status === 'pending_review');
  const doneList    = issues.filter((i) => i.status === 'done');
  const displayList = tab === 'open' ? openList : tab === 'pending' ? pendingList : doneList;

  const renderModalContent = () => {
    if (!selected) return null;
    const status = selected.status as IssueStatus;
    const cfg = STATUS_CONFIG[status];

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.modalStatusPill, { backgroundColor: cfg.color + '18' }]}>
          <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[styles.modalStatusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.modalTitle}>{selected.title}</Text>
        <Text style={styles.modalProp}>{(selected.property as any)?.name ?? ''}</Text>
        {selected.description ? <Text style={styles.modalDesc}>{selected.description}</Text> : null}
        <Text style={styles.modalMeta}>Reported {format(new Date(selected.created_at), 'MMM d, yyyy')}</Text>

        {status === 'open' && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionHead}>Mark as Complete</Text>

            {/* Required photo indicator */}
            <View style={styles.requiredRow}>
              <Ionicons name="camera" size={16} color={afterPhotoUri ? Colors.success : Colors.danger} />
              <Text style={[styles.requiredLabel, { color: afterPhotoUri ? Colors.success : Colors.danger }]}>
                {afterPhotoUri ? 'Completion photo added ✓' : 'Completion photo required *'}
              </Text>
            </View>

            {afterPhotoUri ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: afterPhotoUri }} style={styles.photoImage} resizeMode="cover" />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setAfterPhotoUri(null)}>
                  <Ionicons name="close-circle" size={26} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={handleAddAfterPhoto} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Take / Upload Photo</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.modalLabel}>Notes (optional)</Text>
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
              style={[styles.submitBtn, (!afterPhotoUri || submitting) && styles.submitBtnDisabled]}
              onPress={submitCompletion}
              disabled={!afterPhotoUri || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit for Manager Review</Text>
                </>
              )}
            </TouchableOpacity>
            {!afterPhotoUri && (
              <Text style={styles.photoRequiredNote}>
                A photo is required before you can submit.
              </Text>
            )}
          </>
        )}

        {status === 'pending_review' && (
          <View style={[styles.infoBox, { borderColor: '#F39C1240' }]}>
            <Ionicons name="time-outline" size={32} color="#F39C12" />
            <Text style={[styles.infoBoxTitle, { color: '#F39C12' }]}>Submitted for Review</Text>
            <Text style={styles.infoBoxBody}>Your completion photo has been submitted. A manager will review and close the issue.</Text>
            {selected.resolution_notes ? <Text style={styles.infoBoxNote}>Your note: "{selected.resolution_notes}"</Text> : null}
          </View>
        )}

        {status === 'done' && (
          <View style={[styles.infoBox, { borderColor: Colors.success + '40' }]}>
            <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
            <Text style={[styles.infoBoxTitle, { color: Colors.success }]}>Issue Closed</Text>
            <Text style={styles.infoBoxBody}>This issue was reviewed and closed by a manager.</Text>
            {selected.resolution_notes ? <Text style={styles.infoBoxNote}>Notes: "{selected.resolution_notes}"</Text> : null}
          </View>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
          <Text style={styles.cancelBtnText}>{status === 'open' ? 'Cancel' : 'Close'}</Text>
        </TouchableOpacity>
      </ScrollView>
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
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{profile?.full_name ?? 'Tech'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Manuals')} style={styles.headerBtn}>
            <Ionicons name="book-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        {([
          { key: 'open',    label: 'Open',    count: openList.length,    activeStyle: styles.tabBtnActiveOpen,    color: Colors.danger  },
          { key: 'pending', label: 'Pending', count: pendingList.length, activeStyle: styles.tabBtnActivePending, color: '#F39C12'      },
          { key: 'done',    label: 'Done',    count: doneList.length,    activeStyle: styles.tabBtnActiveDone,    color: Colors.success },
        ] as const).map(({ key, label, count, activeStyle, color }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && activeStyle]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabLabel, tab === key && { color }]}>
              {label}{count > 0 ? ` (${count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {displayList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={tab === 'done' ? 'checkmark-circle-outline' : tab === 'pending' ? 'time-outline' : 'clipboard-outline'}
              size={48}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {tab === 'done' ? 'No completed issues' : tab === 'pending' ? 'Nothing awaiting review' : 'No open issues'}
            </Text>
            {tab === 'open' && <Text style={styles.emptyText}>You're all caught up!</Text>}
          </View>
        ) : (
          displayList.map((item) => (
            <IssueRow key={item.id} item={item} onPress={handleRowPress} />
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddIssue')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            {renderModalContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  greeting:      { ...Typography.bodySmall, color: Colors.textSecondary },
  name:          { ...Typography.h2 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn:     { padding: 8 },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  tabBtn: {
    flex: 1, borderRadius: Radius.md, borderWidth: 2,
    borderColor: Colors.border, paddingVertical: 10,
    alignItems: 'center', backgroundColor: Colors.surface,
  },
  tabBtnActiveOpen:    { borderColor: Colors.danger,  backgroundColor: Colors.danger  + '10' },
  tabBtnActivePending: { borderColor: '#F39C12',       backgroundColor: '#F39C1215'           },
  tabBtnActiveDone:    { borderColor: Colors.success,  backgroundColor: Colors.success + '10' },
  tabLabel: { ...Typography.label, color: Colors.textSecondary },

  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: 100 },

  issueCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    marginBottom: Spacing.sm, flexDirection: 'row',
    alignItems: 'flex-start', overflow: 'hidden', ...Shadow.card,
  },
  statusBar: { width: 4, alignSelf: 'stretch' },
  issueBody: { flex: 1, padding: Spacing.md, gap: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: Radius.full,
    borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  pillText:       { fontSize: 11, fontWeight: '700' },
  issueTitle:     { ...Typography.body, fontWeight: '700', marginBottom: 2 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText:       { ...Typography.caption },
  dot:            { color: Colors.textMuted, fontSize: 12 },
  actionHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  actionHintText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },

  emptyState: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText:  { ...Typography.bodySmall, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: Spacing.xl, right: Spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.card, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '92%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.md,
  },
  modalStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: Spacing.sm,
  },
  modalStatusText: { fontSize: 12, fontWeight: '700' },
  modalTitle:  { ...Typography.h2, marginBottom: 4 },
  modalProp:   { ...Typography.bodySmall, color: Colors.primary, marginBottom: 4 },
  modalDesc:   { ...Typography.body, color: Colors.textSecondary, marginBottom: 4 },
  modalMeta:   { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  sectionHead: { ...Typography.h3, marginBottom: Spacing.sm },
  modalLabel:  { ...Typography.label, marginBottom: 4, marginTop: Spacing.sm },

  requiredRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  requiredLabel: { fontSize: 13, fontWeight: '700' },

  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    height: 64, marginBottom: Spacing.md,
  },
  photoBtnText:   { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  photoPreview:   { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md },
  photoImage:     { width: '100%', height: 200 },
  removePhotoBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 13 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
    ...Typography.body, color: Colors.textPrimary, minHeight: 70, marginBottom: Spacing.md,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F39C12', borderRadius: Radius.md, height: 52, marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: Colors.textMuted },
  submitBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  photoRequiredNote: { ...Typography.caption, color: Colors.danger, textAlign: 'center', marginTop: 8 },

  infoBox: {
    alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.background,
    borderRadius: Radius.lg, padding: Spacing.lg, marginVertical: Spacing.md, borderWidth: 1,
  },
  infoBoxTitle: { ...Typography.h3 },
  infoBoxBody:  { ...Typography.body, textAlign: 'center', color: Colors.textSecondary },
  infoBoxNote:  { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center' },

  cancelBtn:     { alignItems: 'center', padding: Spacing.md, marginTop: 4 },
  cancelBtnText: { ...Typography.body, color: Colors.textSecondary },
});
