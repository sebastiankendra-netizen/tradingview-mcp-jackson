import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase, uploadPhoto } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { CHECKLIST_CATEGORIES, buildChecklistItems } from '../../data/checklist';
import { useAuth } from '../../context/AuthContext';
import ChecklistItemRow from '../../components/ChecklistItemRow';
import ConditionStars from '../../components/ConditionStars';
import PhotoGallery from '../../components/PhotoGallery';
import { ChecklistItem, ChecklistStatus, InspectorStackParamList, Property } from '../../types';

type Route = RouteProp<InspectorStackParamList, 'ConductInspection'>;

interface LocalPhoto {
  uri: string;
  category: string;
  uploaded?: boolean;
  storagePath?: string;
}

export default function ConductInspectionScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { propertyId, inspectionId } = route.params;

  const [property, setProperty] = useState<Property | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [conditionScore, setConditionScore] = useState<number | undefined>();
  const [generalNotes, setGeneralNotes] = useState('');
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data: prop } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();
    setProperty(prop ?? null);

    let { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('sort_order');

    if (!items || items.length === 0) {
      const seed = buildChecklistItems(inspectionId);
      const { data: inserted } = await supabase
        .from('checklist_items')
        .insert(seed)
        .select();
      items = inserted ?? [];
    }

    const { data: insp } = await supabase
      .from('inspections')
      .select('condition_score, notes')
      .eq('id', inspectionId)
      .single();

    if (insp) {
      setConditionScore(insp.condition_score ?? undefined);
      setGeneralNotes(insp.notes ?? '');
    }

    setChecklistItems((items ?? []) as ChecklistItem[]);
    setLoading(false);
  }, [inspectionId, propertyId]);

  useEffect(() => { load(); }, [load]);

  async function handleItemChange(itemId: string, status: ChecklistStatus, notes: string) {
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status, notes } : i)),
    );
    await supabase
      .from('checklist_items')
      .update({ status, notes: notes || null })
      .eq('id', itemId);
  }

  async function handleAddPhoto(category: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in your iPhone Settings to take inspection photos.',
        [{ text: 'OK' }],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: false,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    setLocalPhotos((prev) => [...prev, { uri: asset.uri, category }]);
  }

  function photosForCategory(category: string) {
    return localPhotos
      .filter((p) => p.category === category)
      .map((p) => ({ uri: p.uri }));
  }

  function removeCategoryPhoto(category: string, index: number) {
    const catPhotos = localPhotos.filter((p) => p.category === category);
    const toRemove = catPhotos[index];
    setLocalPhotos((prev) => prev.filter((p) => p !== toRemove));
  }

  // Does this category have any pass/fail items that require a photo?
  function categoryNeedsPhoto(category: string) {
    return checklistItems.some(
      (i) => i.category === category && (i.status === 'pass' || i.status === 'fail'),
    );
  }

  async function uploadAllPhotos() {
    const unuploaded = localPhotos.filter((p) => !p.uploaded);
    for (const photo of unuploaded) {
      try {
        // Link photo to the first checklist item in the category
        const firstItem = checklistItems.find((i) => i.category === photo.category);
        if (!firstItem) continue;

        const ext = photo.uri.split('.').pop() ?? 'jpg';
        const path = `${inspectionId}/${firstItem.id}/${Date.now()}.${ext}`;
        await uploadPhoto('inspection-photos', path, photo.uri);

        await supabase.from('item_photos').insert({
          checklist_item_id: firstItem.id,
          inspection_id: inspectionId,
          storage_path: path,
          uploaded_by: profile?.id,
        });

        photo.uploaded = true;
        photo.storagePath = path;
      } catch (e) {
        console.warn('Photo upload failed', e);
      }
    }
  }

  async function handleSaveDraft() {
    await supabase
      .from('inspections')
      .update({
        condition_score: conditionScore ?? null,
        notes: generalNotes.trim() || null,
      })
      .eq('id', inspectionId);

    await uploadAllPhotos();
    navigation.goBack();
  }

  async function handleSubmit() {
    const pending = checklistItems.filter((i) => i.status === 'pending');
    if (pending.length > 0) {
      Alert.alert(
        'Incomplete Checklist',
        `${pending.length} item(s) are still pending. Submit anyway?`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Submit Anyway', onPress: () => validatePhotos() },
        ],
      );
      return;
    }
    validatePhotos();
  }

  function validatePhotos() {
    const sectionsNeedingPhoto = CHECKLIST_CATEGORIES
      .map((cat) => cat.name)
      .filter((name) => categoryNeedsPhoto(name) && photosForCategory(name).length === 0);

    if (sectionsNeedingPhoto.length > 0) {
      Alert.alert(
        'Photos Required',
        `${sectionsNeedingPhoto.length} section(s) still need a photo:\n\n${sectionsNeedingPhoto.join('\n')}`,
        [{ text: 'OK' }],
      );
      return;
    }
    if (!conditionScore) {
      Alert.alert('Condition Score Required', 'Please rate the overall property condition before submitting.');
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setSubmitting(true);
    await uploadAllPhotos();

    const failedItems = checklistItems.filter((i) => i.status === 'fail');
    for (const item of failedItems) {
      const { data: existing } = await supabase
        .from('maintenance_issues')
        .select('id')
        .eq('checklist_item_id', item.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('maintenance_issues').insert({
          property_id: propertyId,
          inspection_id: inspectionId,
          checklist_item_id: item.id,
          title: `${item.category}: ${item.item_name}`,
          description: item.notes ?? null,
          priority: 'medium',
          status: 'open',
          created_by: profile?.id,
        });
      }
    }

    await supabase
      .from('inspections')
      .update({
        status: 'submitted',
        condition_score: conditionScore ?? null,
        notes: generalNotes.trim() || null,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', inspectionId);

    setSubmitting(false);
    Alert.alert('Inspection Submitted', 'Your report has been submitted.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  const progress = Math.round(
    (checklistItems.filter((i) => i.status !== 'pending').length / Math.max(checklistItems.length, 1)) * 100,
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}% complete</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Property name */}
          <View style={styles.propHeader}>
            <Ionicons name="business" size={20} color={Colors.primary} />
            <Text style={styles.propName}>{property?.name ?? 'Property'}</Text>
          </View>

          {/* Checklist categories */}
          {CHECKLIST_CATEGORIES.map((cat) => {
            const catItems = checklistItems.filter((i) => i.category === cat.name);
            const photos = photosForCategory(cat.name);
            const needsPhoto = categoryNeedsPhoto(cat.name);
            const photoMissing = needsPhoto && photos.length === 0;

            return (
              <View key={cat.name} style={styles.categoryBlock}>

                {/* Category header with camera button */}
                <View style={styles.categoryHeader}>
                  <Ionicons name="list" size={16} color={Colors.primary} />
                  <Text style={styles.categoryTitle}>{cat.name}</Text>
                  <TouchableOpacity
                    style={[
                      styles.catPhotoBtn,
                      photoMissing && styles.catPhotoBtnRequired,
                      !photoMissing && photos.length > 0 && styles.catPhotoBtnDone,
                    ]}
                    onPress={() => handleAddPhoto(cat.name)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="camera"
                      size={15}
                      color={photoMissing ? Colors.danger : photos.length > 0 ? Colors.success : Colors.textMuted}
                    />
                    <Text style={[
                      styles.catPhotoBtnText,
                      photoMissing && { color: Colors.danger },
                      photos.length > 0 && { color: Colors.success },
                    ]}>
                      {photoMissing ? 'Required' : photos.length > 0 ? `${photos.length} photo` : 'Add photo'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Checklist items — no per-item camera */}
                {catItems.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    itemName={item.item_name}
                    status={item.status}
                    notes={item.notes}
                    hideCamera
                    onChange={(status, notes) => handleItemChange(item.id, status, notes)}
                    onAddPhoto={() => {}}
                  />
                ))}

                {/* Category photo gallery */}
                {photos.length > 0 && (
                  <View style={styles.galleryContainer}>
                    <PhotoGallery
                      photos={photos}
                      onAdd={() => handleAddPhoto(cat.name)}
                      onRemove={(index) => removeCategoryPhoto(cat.name, index)}
                    />
                  </View>
                )}
              </View>
            );
          })}

          {/* Overall condition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall Condition *</Text>
            <View style={styles.starsBox}>
              <ConditionStars value={conditionScore} onChange={setConditionScore} size="lg" />
            </View>
          </View>

          {/* General notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>General Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Any additional observations about the property..."
              placeholderTextColor={Colors.textMuted}
              value={generalNotes}
              onChangeText={setGeneralNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft} activeOpacity={0.85}>
              <Ionicons name="save-outline" size={18} color={Colors.primary} />
              <Text style={styles.draftBtnText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressBar: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressText: { ...Typography.caption, color: Colors.primary, fontWeight: '600', width: 80, textAlign: 'right' },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  propHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  propName: { ...Typography.h3, color: Colors.primary },
  categoryBlock: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  categoryTitle: { ...Typography.h3, flex: 1 },
  catPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  catPhotoBtnRequired: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + '12',
  },
  catPhotoBtnDone: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '12',
  },
  catPhotoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  galleryContainer: { marginTop: Spacing.sm },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.md },
  starsBox: { alignItems: 'center', paddingVertical: Spacing.sm },
  notesInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  draftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    height: 52,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  draftBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    height: 52,
    backgroundColor: Colors.primary,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
