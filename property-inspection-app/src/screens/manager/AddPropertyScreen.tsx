import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';

export default function AddPropertyScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();

  // Use refs so typing never triggers a re-render (fixes keyboard dismissal on new arch)
  const form = useRef({ name: '', address: '', city: 'Fort Myers', state: 'FL', zip: '', notes: '' });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const { name, address, city, state, zip, notes } = form.current;
    if (!name.trim() || !address.trim()) {
      setError('Property name and address are required.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from('properties').insert({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip: zip.trim() || null,
      notes: notes.trim() || null,
      created_by: profile?.id,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Property Name *</Text>
          <TextInput
            style={styles.input}
            defaultValue=""
            onChangeText={(v) => { form.current.name = v; }}
            placeholder="e.g. Sunset Villas"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Street Address *</Text>
          <TextInput
            style={styles.input}
            defaultValue=""
            onChangeText={(v) => { form.current.address = v; }}
            placeholder="e.g. 1420 Palm Beach Blvd"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                defaultValue="Fort Myers"
                onChangeText={(v) => { form.current.city = v; }}
                placeholder="Fort Myers"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                defaultValue="FL"
                onChangeText={(v) => { form.current.state = v; }}
                placeholder="FL"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ZIP</Text>
              <TextInput
                style={styles.input}
                defaultValue=""
                onChangeText={(v) => { form.current.zip = v; }}
                placeholder="33901"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            defaultValue=""
            onChangeText={(v) => { form.current.notes = v; }}
            placeholder="Any special notes about this property..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Property</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  row: { flexDirection: 'row' },
  fieldGroup: { marginBottom: Spacing.md },
  label: { ...Typography.label, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  inputMultiline: { height: 88, textAlignVertical: 'top' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 6,
  },
  errorText: { ...Typography.bodySmall, color: Colors.danger, flex: 1 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
