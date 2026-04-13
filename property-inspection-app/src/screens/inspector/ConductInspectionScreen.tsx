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
  checklistItemId: string;
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

    // Load or create checklist items
    let { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('sort_order');

    if (!items || items.length === 0) {
      // First open — seed checklist
      const seed = buildChecklistItems(inspectionId);
      const { data: inserted } = await supabase
        .from('checklist_items')
        .insert(seed)
        .select();
      items = inserted ?? [];
    }

    // Load existing inspection notes/score
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

  async function handleItemChange(
    itemId: string,
    status: ChecklistStatus,
    notes: string,
  ) {
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status, notes } : i)),
    );
    await supabase
      .from('checklist_items')
      .update({ status, notes: notes || null })
      .eq('id', itemId);
  }

  async function handleAddPhoto(itemId: string) {
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

    setLocalPhotos((prev) => [...prev, { uri: asset.uri, checklistItemId: itemId }]);
  }

  function photosForItem(itemId: string) {
    return localPhotos
      .filter((p) => p.checklistItemId === itemId)
      .map((p) => ({ uri: p.uri }));
  }

  function removePhoto(itemId: string, index: number) {
    const itemPhotos = localPhotos.filter((p) => p.checklistItemId === itemId);
    const toRemove = itemPhotos[index];
    setLocalPhotos((prev) => prev.filter((p) => p !== toRemove));
  }

  async function uploadAllPhotos() {
    const unuploaded = localPhotos.filter((p) => !p.uploaded);
    for (const photo of unuploaded) {
      try {
        const ext = photo.uri.split('.').pop() ?? 'jpg';
        const path = `${inspectionId}/${photo.checklistItemId}/${Date.now()}.${ext}`;
        await uploadPhoto('inspection-photos', path, photo.uri);

        // Save to db — inspection_id is NOT NULL in schema
        await supabase.from('item_photos').insert({
          checklist_item_id: photo.checklistItemId,
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
    const missingPhotos = checklistItems.filter(
      (i) => i.status !== 'na' && i.status !== 'pending' && photosForItem(i.id).length === 0,
    );
    if (missingPhotos.length > 0) {
      Alert.alert(
        'Photos Required',
        `${missingPhotos.length} item(s) need a photo. Tap the camera button on each inspected item before submitting.`,
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

    // Auto-create maintenance issues for failed items
    const failedItems = checklistItems.filter((i) => i.status === 'fail');
    for (const item of failedItems) {
      // Check if issue already exists
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
          priority: 'medium',   // default; manager can escalate
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
            return (
              <View key={cat.name} style={styles.categoryBlock}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="list" size={16} color={Colors.primary} />
                  <Text style={styles.categoryTitle}>{cat.name}</Text>
                </View>

                {catItems.map((item) => (
                  <View key={item.id}>
                    <ChecklistItemRow
                      itemName={item.item_name}
                      status={item.status}
                      notes={item.notes}
                      photoCount={photosForItem(item.id).length}
                      photoRequired={item.status !== 'na' && item.status !== 'pending' && photosForItem(item.id).length === 0}
                      onChange={(status, notes) => handleItemChange(item.id, status, notes)}
                      onAddPhoto={() => handleAddPhoto(item.id)}
                    />
                    {photosForItem(item.id).length > 0 && (
                      <PhotoGallery
                        photos={photosForItem(item.id)}
                        onAdd={() => handleAddPhoto(item.id)}
                        onRemove={(index) => removePhoto(item.id, index)}
                      />
                    )}
                  </View>
                ))}
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
  categoryTitle: { ...Typography.h3 },
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
