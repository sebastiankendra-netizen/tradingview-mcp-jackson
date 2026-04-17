import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';
import { InspectorStackParamList, Property } from '../../types';

type Nav = NativeStackNavigationProp<InspectorStackParamList>;

interface AssignedProperty extends Property {
  inProgressInspectionId?: string;
}

export default function MyPropertiesScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, signOut } = useAuth();
  const [properties, setProperties] = useState<AssignedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    // Get all property assignments for this inspector
    const { data: assignments } = await supabase
      .from('property_assignments')
      .select('property_id')
      .eq('inspector_id', profile.id)
      .eq('is_active', true);

    if (!assignments || assignments.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }

    const propertyIds = assignments.map((a) => a.property_id);

    // Get property details
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .in('id', propertyIds)
      .order('name');

    // Check for any in-progress inspections by this inspector
    const { data: inProgress } = await supabase
      .from('inspections')
      .select('id, property_id')
      .eq('inspector_id', profile.id)
      .eq('status', 'in_progress')
      .in('property_id', propertyIds);

    const enriched: AssignedProperty[] = (props ?? []).map((p) => ({
      ...p,
      inProgressInspectionId: inProgress?.find((i) => i.property_id === p.id)?.id,
    }));

    setProperties(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function startInspection(property: AssignedProperty) {
    if (!profile) return;

    // If there's already an in-progress one, resume it
    if (property.inProgressInspectionId) {
      navigation.navigate('ConductInspection', {
        propertyId: property.id,
        inspectionId: property.inProgressInspectionId,
      });
      return;
    }

    // Confirm start
    Alert.alert(
      'Start Inspection',
      `Start a new inspection for ${property.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            const { data, error } = await supabase
              .from('inspections')
              .insert({
                property_id: property.id,
                inspector_id: profile.id,
                status: 'in_progress',
              })
              .select()
              .single();

            if (error || !data) {
              Alert.alert('Error', error?.message ?? 'Could not create inspection.');
              return;
            }

            navigation.navigate('ConductInspection', {
              propertyId: property.id,
              inspectionId: data.id,
            });
          },
        },
      ],
    );
  }

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
          <Text style={styles.name}>{profile?.full_name ?? 'Inspector'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Manuals')} style={styles.headerBtn}>
            <Ionicons name="library-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>My Assigned Properties</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.propertyCard}
            onPress={() => startInspection(item)}
            activeOpacity={0.85}
          >
            <View style={styles.cardLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="business" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.propName}>{item.name}</Text>
                <Text style={styles.propAddress}>
                  {item.address}, {item.city}
                </Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              {item.inProgressInspectionId ? (
                <View style={styles.resumePill}>
                  <Ionicons name="play-circle" size={14} color={Colors.accent} />
                  <Text style={styles.resumeText}>Resume</Text>
                </View>
              ) : (
                <View style={styles.startPill}>
                  <Ionicons name="add-circle" size={14} color={Colors.primary} />
                  <Text style={styles.startText}>Inspect</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No properties assigned</Text>
            <Text style={styles.emptyText}>
              Ask your manager to assign properties to you.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  greeting: { ...Typography.bodySmall, color: Colors.textSecondary },
  name: { ...Typography.h2 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 8 },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xxl },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.md },
  propertyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propName: { ...Typography.body, fontWeight: '600', marginBottom: 2 },
  propAddress: { ...Typography.caption, color: Colors.textSecondary },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  resumePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent + '20',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resumeText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  startPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  startText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  emptyState: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center' },
});
