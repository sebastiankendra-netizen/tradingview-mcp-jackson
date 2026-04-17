import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';
import { getSignedUrl, supabase, uploadFile } from '../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../lib/theme';
import { useAuth } from '../context/AuthContext';
import { CompanyDocument } from '../types';

const CATEGORIES = ['General', 'Safety', 'Maintenance', 'Emergency'];

type CategoryFilter = 'All' | typeof CATEGORIES[number];

function fileIcon(mimeType?: string): { name: string; color: string } {
  if (!mimeType) return { name: 'document-attach-outline', color: Colors.textMuted };
  if (mimeType.includes('pdf')) return { name: 'document-text-outline', color: Colors.danger };
  if (mimeType.includes('word') || mimeType.includes('docx')) return { name: 'document-outline', color: Colors.primary };
  if (mimeType.includes('image')) return { name: 'image-outline', color: Colors.success };
  if (mimeType.includes('text')) return { name: 'document-outline', color: Colors.textSecondary };
  return { name: 'document-attach-outline', color: Colors.textMuted };
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ManualsScreen() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('company_documents')
      .select('*, uploader:profiles!company_documents_uploaded_by_fkey(id, full_name)')
      .order('created_at', { ascending: false });
    setDocs((data ?? []) as CompanyDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function resetUploadModal() {
    setUploadTitle('');
    setUploadDesc('');
    setUploadCategory('General');
    setPickedFile(null);
    setShowUpload(false);
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/*',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPickedFile(result.assets[0]);
    }
  }

  async function doUpload() {
    if (!uploadTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this document.');
      return;
    }
    if (!pickedFile) {
      Alert.alert('File Required', 'Please choose a file to upload.');
      return;
    }
    if (!profile) return;

    setUploading(true);
    try {
      const safeName = `${Date.now()}_${pickedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = `documents/${safeName}`;
      const mimeType = pickedFile.mimeType ?? 'application/octet-stream';

      await uploadFile('company-documents', storagePath, pickedFile.uri, mimeType);
      await supabase.from('company_documents').insert({
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        file_name: pickedFile.name,
        storage_path: storagePath,
        file_size: pickedFile.size,
        mime_type: mimeType,
        category: uploadCategory,
        uploaded_by: profile.id,
      });

      resetUploadModal();
      load();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Could not upload the document.');
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(doc: CompanyDocument) {
    setOpening(doc.id);
    const url = await getSignedUrl('company-documents', doc.storage_path, 3600);
    setOpening(null);
    if (!url) {
      Alert.alert('Error', 'Could not load this document. Please try again.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Cannot Open', 'No app available to open this file type.');
    });
  }

  function confirmDelete(doc: CompanyDocument) {
    Alert.alert('Delete Document', `Delete "${doc.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.storage.from('company-documents').remove([doc.storage_path]);
          await supabase.from('company_documents').delete().eq('id', doc.id);
          setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        },
      },
    ]);
  }

  const tabs: CategoryFilter[] = ['All', ...CATEGORIES];
  const filtered = categoryFilter === 'All' ? docs : docs.filter((d) => d.category === categoryFilter);
  const countFor = (cat: CategoryFilter) => cat === 'All' ? docs.length : docs.filter((d) => d.category === cat).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* Category tab row */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const active = categoryFilter === tab;
          const count = countFor(tab);
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setCategoryFilter(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {tab}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Document list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No documents here</Text>
            <Text style={styles.emptyText}>
              {isManager ? 'Tap + to upload a document.' : 'No documents have been uploaded yet.'}
            </Text>
          </View>
        ) : (
          filtered.map((doc) => {
            const { name: iconName, color: iconColor } = fileIcon(doc.mime_type);
            const isOpening = opening === doc.id;
            return (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => openDocument(doc)}
                activeOpacity={0.75}
              >
                <View style={[styles.docIconBox, { backgroundColor: iconColor + '18' }]}>
                  {isOpening
                    ? <ActivityIndicator size="small" color={iconColor} />
                    : <Ionicons name={iconName as any} size={24} color={iconColor} />
                  }
                </View>
                <View style={styles.docBody}>
                  <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
                  {doc.description ? (
                    <Text style={styles.docDesc} numberOfLines={2}>{doc.description}</Text>
                  ) : null}
                  <View style={styles.docMeta}>
                    <View style={styles.catPill}>
                      <Text style={styles.catPillText} numberOfLines={1}>{doc.category}</Text>
                    </View>
                    {doc.file_size ? <Text style={styles.metaText}>{formatBytes(doc.file_size)}</Text> : null}
                    <Text style={styles.metaText}>{format(new Date(doc.created_at), 'MMM d, yyyy')}</Text>
                  </View>
                </View>
                <View style={styles.docRight}>
                  {isManager && (
                    <TouchableOpacity
                      onPress={() => confirmDelete(doc)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                  <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowUpload(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Upload Modal */}
      <Modal visible={showUpload} transparent animationType="slide" onRequestClose={resetUploadModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Upload Document</Text>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Move-In Checklist"
                placeholderTextColor={Colors.textMuted}
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={styles.inputMulti}
                placeholder="Brief summary..."
                placeholderTextColor={Colors.textMuted}
                value={uploadDesc}
                onChangeText={setUploadDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((cat) => {
                  const active = uploadCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catChip, active && styles.catChipActive]}
                      onPress={() => setUploadCategory(cat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>File *</Text>
              <TouchableOpacity style={styles.filePickerBtn} onPress={pickFile} activeOpacity={0.8}>
                <Ionicons name="attach-outline" size={20} color={Colors.primary} />
                <Text style={styles.filePickerText} numberOfLines={2}>
                  {pickedFile ? pickedFile.name : 'Choose PDF, Word doc, or image...'}
                </Text>
              </TouchableOpacity>
              {pickedFile?.size ? (
                <Text style={styles.fileSize}>{formatBytes(pickedFile.size)}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                onPress={doUpload}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={styles.uploadBtnText}>Upload Document</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={resetUploadModal}>
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

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  tabBadgeTextActive: { color: '#fff' },

  list: { padding: Spacing.md, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center', color: Colors.textMuted },

  docCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  docIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docBody: { flex: 1, minWidth: 0 },
  docTitle: { ...Typography.body, fontWeight: '600', marginBottom: 2 },
  docDesc: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  docMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  catPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: Colors.primary + '15',
    maxWidth: 100,
  },
  catPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  metaText: { ...Typography.caption },
  docRight: { flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 },
  deleteBtn: { padding: 2 },

  fab: {
    position: 'absolute', bottom: Spacing.xl, right: Spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.card, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '92%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.md,
  },
  modalTitle: { ...Typography.h2, marginBottom: Spacing.md },
  inputLabel: { ...Typography.label, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    ...Typography.body, color: Colors.textPrimary,
  },
  inputMulti: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    ...Typography.body, color: Colors.textPrimary,
    minHeight: 72, textAlignVertical: 'top',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  catChip: {
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.surface,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catChipTextActive: { color: '#fff' },
  filePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    paddingHorizontal: Spacing.sm, paddingVertical: 12, marginBottom: 4,
  },
  filePickerText: { ...Typography.body, color: Colors.primary, flex: 1 },
  fileSize: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md,
    height: 52, marginTop: Spacing.md,
  },
  uploadBtnDisabled: { backgroundColor: Colors.textMuted },
  uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { ...Typography.body, color: Colors.textSecondary },
});
