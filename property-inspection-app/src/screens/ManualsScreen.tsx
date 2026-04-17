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

const CATEGORIES = ['General', 'Safety', 'HR & Policies', 'Maintenance', 'Emergency Protocols', 'Training'];

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
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ManualsScreen() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Upload modal state
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

  const allCategories = ['All', ...CATEGORIES];
  const filtered = categoryFilter === 'All' ? docs : docs.filter((d) => d.category === categoryFilter);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {allCategories.map((cat) => {
          const active = categoryFilter === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategoryFilter(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Document list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptyText}>
              {isManager
                ? 'Tap the + button to upload your first manual or policy.'
                : 'No company documents have been uploaded yet.'}
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
                  {isOpening ? (
                    <ActivityIndicator size="small" color={iconColor} />
                  ) : (
                    <Ionicons name={iconName as any} size={26} color={iconColor} />
                  )}
                </View>
                <View style={styles.docBody}>
                  <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
                  {doc.description ? (
                    <Text style={styles.docDesc} numberOfLines={1}>{doc.description}</Text>
                  ) : null}
                  <View style={styles.docMeta}>
                    <View style={styles.catPill}>
                      <Text style={styles.catPillText}>{doc.category}</Text>
                    </View>
                    {doc.file_size ? (
                      <Text style={styles.metaText}>{formatBytes(doc.file_size)}</Text>
                    ) : null}
                    <Text style={styles.metaText}>{format(new Date(doc.created_at), 'MMM d, yyyy')}</Text>
                  </View>
                </View>
                <View style={styles.docActions}>
                  {isManager && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => confirmDelete(doc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                  <Ionicons name="open-outline" size={17} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Manager FAB */}
      {isManager && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowUpload(true)}
          activeOpacity={0.85}
        >
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
                placeholder="e.g. Tenant Move-In Checklist"
                placeholderTextColor={Colors.textMuted}
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Brief summary of this document..."
                placeholderTextColor={Colors.textMuted}
                value={uploadDesc}
                onChangeText={setUploadDesc}
                multiline
                numberOfLines={2}
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
                <Text style={styles.filePickerText} numberOfLines={1}>
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

  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  chip: {
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.label, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  list: { padding: Spacing.md, paddingBottom: 100 },
  emptyState: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm, marginTop: Spacing.xl },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center', color: Colors.textMuted },

  docCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, ...Shadow.card,
  },
  docIconBox: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  docBody: { flex: 1 },
  docTitle: { ...Typography.body, fontWeight: '600', marginBottom: 2 },
  docDesc: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catPill: { borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: Colors.primary + '15' },
  catPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  metaText: { ...Typography.caption },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteBtn: { padding: 2 },

  fab: {
    position: 'absolute', bottom: Spacing.xl, right: Spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', ...Shadow.card, elevation: 6,
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
  modalTitle: { ...Typography.h2, marginBottom: Spacing.md },
  inputLabel: { ...Typography.label, marginBottom: 4, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.sm, ...Typography.body,
    color: Colors.textPrimary, marginBottom: 4,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  catChip: {
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: Colors.surface,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  catChipTextActive: { color: '#fff' },
  filePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary,
    borderStyle: 'dashed', padding: Spacing.sm, marginBottom: 4,
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
