import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}

export default function AddPropertyScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Fort Myers');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Property Name *" value={name} onChange={setName} placeholder="e.g. Sunset Villas" />
          <Field label="Street Address *" value={address} onChange={setAddress} placeholder="e.g. 1420 Palm Beach Blvd" />
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Field label="City" value={city} onChange={setCity} placeholder="Fort Myers" />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Field label="State" value={state} onChange={setState} placeholder="FL" autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Field label="ZIP" value={zip} onChange={setZip} placeholder="33901" keyboardType="numeric" autoCapitalize="none" />
            </View>
          </View>
          <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Any special notes about this property..." multiline />

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
      </KeyboardAvoidingView>
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
