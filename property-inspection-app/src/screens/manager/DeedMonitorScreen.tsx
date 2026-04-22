import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../lib/theme';
import { DeedAlert, DeedSnapshot, Property } from '../../types';

interface PropertyWithDeed extends Property {
  latestSnapshot?: DeedSnapshot;
  hasAlert: boolean;
}

export default function DeedMonitorScreen() {
  const [properties, setProperties] = useState<PropertyWithDeed[]>([]);
  const [alerts, setAlerts] = useState<(DeedAlert & { property?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const [{ data: props }, { data: snapshots }, { data: alertsData }] = await Promise.all([
      supabase.from('properties').select('*').order('name'),
      supabase.from('deed_snapshots').select('*').order('checked_at', { ascending: false }),
      supabase
        .from('deed_alerts')
        .select('*, property:properties(name)')
        .is('acknowledged_at', null)
        .order('detected_at', { ascending: false }),
    ]);

    const alertPropertyIds = new Set((alertsData ?? []).map((a) => a.property_id));

    const enriched: PropertyWithDeed[] = (props ?? []).map((p) => {
      const latest = (snapshots ?? []).find((s) => s.property_id === p.id);
      return { ...p, latestSnapshot: latest ?? undefined, hasAlert: alertPropertyIds.has(p.id) };
    });

    setProperties(enriched);
    setAlerts(alertsData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function acknowledgeAlert(alertId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('deed_alerts')
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id })
      .eq('id', alertId);
    await load();
  }

  async function checkAllDeeds() {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-deeds');
      if (error) throw error;
      await load();
      Alert.alert('Check Complete', (data as any)?.message ?? 'Deed check finished.');
    } catch (e: any) {
      Alert.alert('Check Failed', e.message ?? 'Could not reach leepa.org. Try again later.');
    }
    setChecking(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Deed Monitor</Text>
          <Text style={styles.headerSub}>Weekly fraud detection via leepa.org</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkBtn, checking && { opacity: 0.6 }]}
          onPress={checkAllDeeds}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.checkBtnText}>Check Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Unacknowledged alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={16} color={Colors.danger} />
              <Text style={[styles.sectionTitle, { color: Colors.danger }]}>
                {alerts.length} Unacknowledged Alert{alerts.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertTop}>
                  <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                  <Text style={styles.alertProperty}>
                    {alert.property?.name ?? alert.address}
                  </Text>
                </View>
                <Text style={styles.alertField}>
                  {alert.field_changed.replace(/_/g, ' ').toUpperCase()} changed
                </Text>
                <View style={styles.alertValuesRow}>
                  <Text style={styles.alertOld}>{alert.old_value ?? 'Unknown'}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
                  <Text style={styles.alertNew}>{alert.new_value ?? 'Unknown'}</Text>
                </View>
                <Text style={styles.alertTime}>
                  Detected {formatDistanceToNow(parseISO(alert.detected_at))} ago
                </Text>
                <TouchableOpacity
                  style={styles.ackBtn}
                  onPress={() => acknowledgeAlert(alert.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ackBtnText}>Acknowledge</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* No alerts banner */}
        {alerts.length === 0 && (
          <View style={styles.allClearBanner}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
            <Text style={styles.allClearText}>No alerts — all deeds appear unchanged</Text>
          </View>
        )}

        {/* Property list */}
        <View style={styles.sectionHeader}>
          <Ionicons name="business" size={16} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Monitored Properties</Text>
        </View>

        {properties.map((prop) => (
          <View key={prop.id} style={[styles.propCard, prop.hasAlert && styles.propCardAlert]}>
            <View style={styles.propTop}>
              <View style={styles.propInfo}>
                <Text style={styles.propName}>{prop.name}</Text>
                <Text style={styles.propAddress}>{prop.address}, {prop.city}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                prop.hasAlert ? styles.badgeDanger : prop.latestSnapshot ? styles.badgeOk : styles.badgePending,
              ]}>
                <Ionicons
                  name={prop.hasAlert ? 'warning' : prop.latestSnapshot ? 'checkmark-circle' : 'time-outline'}
                  size={13}
                  color={prop.hasAlert ? Colors.danger : prop.latestSnapshot ? Colors.success : Colors.textMuted}
                />
                <Text style={[
                  styles.statusText,
                  { color: prop.hasAlert ? Colors.danger : prop.latestSnapshot ? Colors.success : Colors.textMuted },
                ]}>
                  {prop.hasAlert ? 'ALERT' : prop.latestSnapshot ? 'OK' : 'Pending'}
                </Text>
              </View>
            </View>

            {prop.latestSnapshot?.owner_name ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Owner</Text>
                <Text style={styles.detailValue}>{prop.latestSnapshot.owner_name}</Text>
              </View>
            ) : null}
            {prop.latestSnapshot?.deed_book ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Deed</Text>
                <Text style={styles.detailValue}>
                  Book {prop.latestSnapshot.deed_book} / Page {prop.latestSnapshot.deed_page}
                </Text>
              </View>
            ) : null}
            {prop.latestSnapshot?.sale_date ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last Sale</Text>
                <Text style={styles.detailValue}>{prop.latestSnapshot.sale_date}</Text>
              </View>
            ) : null}

            <Text style={styles.lastChecked}>
              {prop.latestSnapshot
                ? `Last checked ${formatDistanceToNow(parseISO(prop.latestSnapshot.checked_at))} ago`
                : 'Not yet checked — tap "Check Now" above'}
            </Text>
          </View>
        ))}

        <Text style={styles.footerNote}>
          Checks run automatically every Monday morning. Tap "Check Now" to run manually.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  checkBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  alertsSection: { marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.h3 },
  alertCard: {
    backgroundColor: Colors.danger + '10',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  alertProperty: { ...Typography.body, fontWeight: '700', color: Colors.danger, flex: 1 },
  alertField: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  alertValuesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  alertOld: { ...Typography.bodySmall, color: Colors.danger, textDecorationLine: 'line-through' },
  alertNew: { ...Typography.bodySmall, color: Colors.success, fontWeight: '700' },
  alertTime: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.sm },
  ackBtn: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ackBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  allClearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success + '15',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  allClearText: { ...Typography.body, color: Colors.success, fontWeight: '600' },
  propCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  propCardAlert: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  propTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  propInfo: { flex: 1, marginRight: Spacing.sm },
  propName: { ...Typography.body, fontWeight: '700' },
  propAddress: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeOk: { backgroundColor: Colors.success + '15' },
  badgeDanger: { backgroundColor: Colors.danger + '15' },
  badgePending: { backgroundColor: Colors.border },
  statusText: { fontSize: 11, fontWeight: '700' },
  detailRow: { flexDirection: 'row', gap: 8, marginBottom: 3 },
  detailLabel: { ...Typography.caption, fontWeight: '700', color: Colors.textSecondary, width: 60 },
  detailValue: { ...Typography.caption, color: Colors.textPrimary, flex: 1 },
  lastChecked: { ...Typography.caption, color: Colors.textMuted, marginTop: 6 },
  footerNote: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
});
