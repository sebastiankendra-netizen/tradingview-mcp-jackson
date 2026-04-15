import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase, uploadPhoto } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import {
  IssuePriority,
  ManagerStackParamList,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  Property,
} from '../../types';

type Nav = NativeStackNavigationProp<ManagerStackParamList>;

const PRIORITIES: IssuePriority[] = ['low', 'medium', 'high', 'urgent'];

export default function AddIssueScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loadingProps, setLoadingProps] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('properties')
      .select('id, name, address, city, state, zip, created_by, created_at, updated_at')
      .order('name')
      .then(({ data }) => {
        setProperties((data ?? []) as Property[]);
        setLoadingProps(false);
      });
  }, []);

  async function handleAddPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    Alert.alert('Add Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          if (status !== 'granted') {
            Alert.alert('Camera Permission Required', 'Please allow camera access in Settings.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.75,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libPerm.status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow photo library access in Settings.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.75,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSubmit() {
    if (!selectedPropertyId) {
      Alert.alert('Select a Property', 'Please choose which property this issue is for.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this issue.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Before Photo Required', 'Please take a before photo to document the issue.');
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      const { data: issue, error } = await supabase
        .from('maintenance_issues')
        .insert({
          property_id: selectedPropertyId,
          created_by: profile.id,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status: 'open',
        })
        .select()
        .single();

      if (error || !issue) {
        Alert.alert('Error', error?.message ?? 'Could not create issue.');
        return;
      }

      if (photoUri) {
        try {
          const ext = photoUri.split('.').pop() ?? 'jpg';
          const fileName = `${Date.now()}.${ext}`;
          const storagePath = `issues/${issue.id}/${fileName}`;
          await uploadPhoto('inspection-photos', storagePath, photoUri);
          await supabase.from('issue_photos').insert({
            issue_id: issue.id,
            uploaded_by: profile.id,
            storage_path: storagePath,
            file_name: fileName,
            photo_type: 'before',
          });
        } catch {
          Alert.alert(
            'Photo Upload Failed',
            'Issue was created but the photo could not be uploaded.',
          );
        }
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Property selector */}
          <Text style={styles.sectionLabel}>Property *</Text>
          {loadingProps ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : (
            <View style={styles.propertyList}>
              {properties.map((p) => {
                const selected = selectedPropertyId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.propertyRow, selected && styles.propertyRowSelected]}
                    onPress={() => setSelectedPropertyId(p.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? Colors.primary : Colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.propertyName, selected && { color: Colors.primary }]}>
                        {p.name}
                      </Text>
                      <Text style={styles.propertyAddress}>{p.address}</Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Title */}
          <Text style={styles.sectionLabel}>Issue Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Broken window latch in Unit 3"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
          />

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Priority */}
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p;
              const color = PRIORITY_COLORS[p];
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    active && { backgroundColor: color + '20', borderColor: color },
                  ]}
                  onPress={() => setPriority(p)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.priorityLabel,
                      active && { color, fontWeight: '700' },
                    ]}
                  >
                    {PRIORITY_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Photo */}
          <Text style={styles.sectionLabel}>Before Photo *</Text>
          <Text style={styles.hint}>
            Document the issue before any work is done. Required.
          </Text>
          {photoUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => setPhotoUri(null)}
              >
                <Ionicons name="close-circle" size={26} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={handleAddPhoto}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
              <Text style={styles.photoBtnText}>Add Photo</Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>Submit Issue</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: 60 },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: Spacing.md,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: -4,
  },
  propertyList: { gap: 6 },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  propertyRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  propertyName: { ...Typography.body, fontWeight: '600' },
  propertyAddress: { ...Typography.bodySmall },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  textArea: { minHeight: 90 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  priorityLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    height: 60,
  },
  photoBtnText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  photoPreview: { borderRadius: Radius.md, overflow: 'hidden' },
  photo: { width: '100%', height: 200 },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 13,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 52,
    marginTop: Spacing.xl,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
