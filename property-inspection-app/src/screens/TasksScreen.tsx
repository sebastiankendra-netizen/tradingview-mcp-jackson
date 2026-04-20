import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { format, isPast, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Colors, Radius, Shadow, Spacing, Typography } from '../lib/theme';
import { useAuth } from '../context/AuthContext';
import { IssuePriority, PRIORITY_COLORS, PRIORITY_LABELS, Profile, Property, PropertyTask } from '../types';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type StatusFilter = 'all' | TaskStatus;

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: string }> = {
  todo:        { label: 'To Do',       color: Colors.danger,  icon: 'ellipse-outline'      },
  in_progress: { label: 'In Progress', color: '#F39C12',      icon: 'time-outline'         },
  done:        { label: 'Done',        color: Colors.success, icon: 'checkmark-circle'     },
};

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'todo',        label: 'To Do'       },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done',        label: 'Done'        },
];

interface TaskRowProps {
  task: PropertyTask;
  onPress: (task: PropertyTask) => void;
}

function TaskRow({ task, onPress }: TaskRowProps) {
  const status = (task.status ?? 'todo') as TaskStatus;
  const cfg = STATUS_CONFIG[status];
  const priority = task.priority as IssuePriority;
  const priorityColor = PRIORITY_COLORS[priority] ?? Colors.textMuted;
  const isOverdue = task.due_date && status !== 'done' && isPast(parseISO(task.due_date));

  return (
    <TouchableOpacity style={styles.taskCard} onPress={() => onPress(task)} activeOpacity={0.75}>
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      <View style={styles.taskBody}>
        <View style={styles.taskTopRow}>
          <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <View style={[styles.priorityPill, { backgroundColor: priorityColor + '15' }]}>
            <Text style={[styles.priorityPillText, { color: priorityColor }]}>
              {PRIORITY_LABELS[priority] ?? priority}
            </Text>
          </View>
        </View>
        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        {task.description ? (
          <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
        ) : null}
        <View style={styles.taskMeta}>
          {task.property && (
            <>
              <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{(task.property as any).name}</Text>
              <Text style={styles.dot}>·</Text>
            </>
          )}
          <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {task.assignee ? (task.assignee as any).full_name : 'Unassigned'}
          </Text>
          {task.due_date && (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="calendar-outline" size={12} color={isOverdue ? Colors.danger : Colors.textMuted} />
              <Text style={[styles.metaText, isOverdue && styles.overdueText]}>
                {format(parseISO(task.due_date), 'MMM d')}
                {isOverdue ? ' (overdue)' : ''}
              </Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={{ marginRight: 4 }} />
    </TouchableOpacity>
  );
}

export default function TasksScreen() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [tasks, setTasks] = useState<PropertyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Detail / status modal
  const [selected, setSelected] = useState<PropertyTask | null>(null);

  // Create modal (manager)
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createDue, setCreateDue] = useState('');
  const [createPriority, setCreatePriority] = useState<IssuePriority>('medium');
  const [createPropertyId, setCreatePropertyId] = useState<string | null>(null);
  const [createAssigneeId, setCreateAssigneeId] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    let query = supabase
      .from('property_tasks')
      .select(`
        *,
        property:properties(id, name),
        assignee:profiles!property_tasks_assigned_to_fkey(id, full_name),
        creator:profiles!property_tasks_created_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (!isManager) {
      query = query.eq('assigned_to', profile.id);
    }

    const { data } = await query;
    setTasks((data ?? []) as PropertyTask[]);
    setLoading(false);
  }, [profile, isManager]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function loadCreateData() {
    const [{ data: props }, { data: profiles }] = await Promise.all([
      supabase.from('properties').select('*').order('name'),
      supabase.from('profiles').select('*').in('role', ['maintenance_tech', 'inspector', 'manager']).order('full_name'),
    ]);
    setProperties((props ?? []) as Property[]);
    setStaff((profiles ?? []) as Profile[]);
  }

  function openCreate() {
    loadCreateData();
    setCreateTitle('');
    setCreateDesc('');
    setCreateDue('');
    setCreatePriority('medium');
    setCreatePropertyId(null);
    setCreateAssigneeId(null);
    setShowCreate(true);
  }

  async function createTask() {
    if (!createTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a task title.');
      return;
    }
    if (!createPropertyId) {
      Alert.alert('Property Required', 'Please select a property.');
      return;
    }
    if (!profile) return;
    setCreating(true);
    const { error } = await supabase.from('property_tasks').insert({
      title: createTitle.trim(),
      description: createDesc.trim() || null,
      property_id: createPropertyId,
      assigned_to: createAssigneeId || null,
      due_date: createDue.trim() || null,
      priority: createPriority,
      status: 'todo',
      created_by: profile.id,
    });
    setCreating(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowCreate(false);
    load();
  }

  async function updateStatus(task: PropertyTask, newStatus: TaskStatus) {
    const { error } = await supabase
      .from('property_tasks')
      .update({ status: newStatus })
      .eq('id', task.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    setSelected((s) => s?.id === task.id ? { ...s, status: newStatus } : s);
  }

  function confirmDelete(task: PropertyTask) {
    Alert.alert('Delete Task', `Delete "${task.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('property_tasks').delete().eq('id', task.id);
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          setSelected(null);
        },
      },
    ]);
  }

  const filtered = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);
  const countFor = (key: StatusFilter) => key === 'all' ? tasks.length : tasks.filter((t) => t.status === key).length;

  const selectedProperty = properties.find((p) => p.id === createPropertyId);
  const selectedAssignee = staff.find((s) => s.id === createAssigneeId);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* Status filter tabs */}
      <View style={styles.tabRow}>
        {FILTER_TABS.map(({ key, label }) => {
          const active = statusFilter === key;
          const count = countFor(key);
          const color = key === 'all' ? Colors.primary : STATUS_CONFIG[key as TaskStatus]?.color ?? Colors.primary;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && { backgroundColor: color + '15', borderColor: color }]}
              onPress={() => setStatusFilter(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && { color }]} numberOfLines={1}>{label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, active && { backgroundColor: color }]}>
                  <Text style={[styles.tabBadgeText, active && { color: '#fff' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {statusFilter === 'all' ? 'No tasks yet' : `No ${STATUS_CONFIG[statusFilter as TaskStatus]?.label ?? ''} tasks`}
            </Text>
            <Text style={styles.emptyText}>
              {isManager ? 'Tap + to create a task.' : 'No tasks have been assigned to you.'}
            </Text>
          </View>
        ) : (
          filtered.map((task) => (
            <TaskRow key={task.id} task={task} onPress={setSelected} />
          ))
        )}
      </ScrollView>

      {isManager && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Task Detail / Status Modal */}
      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            {selected && (() => {
              const status = (selected.status ?? 'todo') as TaskStatus;
              const cfg = STATUS_CONFIG[status];
              const priority = selected.priority as IssuePriority;
              const priorityColor = PRIORITY_COLORS[priority] ?? Colors.textMuted;
              const isOverdue = selected.due_date && status !== 'done' && isPast(parseISO(selected.due_date));
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Status + priority */}
                  <View style={styles.detailTopRow}>
                    <View style={[styles.statusPill, { backgroundColor: cfg.color + '18' }]}>
                      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                      <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <View style={[styles.priorityPill, { backgroundColor: priorityColor + '15' }]}>
                      <Text style={[styles.priorityPillText, { color: priorityColor }]}>
                        {PRIORITY_LABELS[priority] ?? priority}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detailTitle}>{selected.title}</Text>
                  {selected.description ? (
                    <Text style={styles.detailDesc}>{selected.description}</Text>
                  ) : null}

                  {/* Meta */}
                  <View style={styles.detailMeta}>
                    {selected.property && (
                      <View style={styles.detailMetaRow}>
                        <Ionicons name="business-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.detailMetaText}>{(selected.property as any).name}</Text>
                      </View>
                    )}
                    <View style={styles.detailMetaRow}>
                      <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailMetaText}>
                        {selected.assignee ? (selected.assignee as any).full_name : 'Unassigned'}
                      </Text>
                    </View>
                    {selected.due_date && (
                      <View style={styles.detailMetaRow}>
                        <Ionicons name="calendar-outline" size={14} color={isOverdue ? Colors.danger : Colors.textMuted} />
                        <Text style={[styles.detailMetaText, isOverdue && { color: Colors.danger }]}>
                          Due {format(parseISO(selected.due_date), 'MMM d, yyyy')}{isOverdue ? ' — Overdue' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Status actions */}
                  <View style={styles.divider} />
                  <Text style={styles.sectionLabel}>Update Status</Text>
                  <View style={styles.statusActions}>
                    {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => {
                      const c = STATUS_CONFIG[s];
                      const isActive = status === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.statusActionBtn, { borderColor: c.color }, isActive && { backgroundColor: c.color }]}
                          onPress={() => updateStatus(selected, s)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={c.icon as any} size={15} color={isActive ? '#fff' : c.color} />
                          <Text style={[styles.statusActionText, { color: isActive ? '#fff' : c.color }]}>{c.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {isManager && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(selected)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={styles.deleteBtnText}>Delete Task</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.cancelBtnText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Create Task Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>New Task</Text>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="What needs to be done?"
                placeholderTextColor={Colors.textMuted}
                value={createTitle}
                onChangeText={setCreateTitle}
              />

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={styles.inputMulti}
                placeholder="More details..."
                placeholderTextColor={Colors.textMuted}
                value={createDesc}
                onChangeText={setCreateDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Property *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowPropertyPicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={18} color={Colors.primary} />
                <Text style={[styles.pickerBtnText, !selectedProperty && { color: Colors.textMuted }]}>
                  {selectedProperty ? selectedProperty.name : 'Select property...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Assign To</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowAssigneePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
                <Text style={[styles.pickerBtnText, !selectedAssignee && { color: Colors.textMuted }]}>
                  {selectedAssignee ? selectedAssignee.full_name : 'Unassigned'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2025-05-01"
                placeholderTextColor={Colors.textMuted}
                value={createDue}
                onChangeText={setCreateDue}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityGrid}>
                {(['low', 'medium', 'high', 'urgent'] as IssuePriority[]).map((p) => {
                  const active = createPriority === p;
                  const color = PRIORITY_COLORS[p];
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityChip, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setCreatePriority(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.priorityChipText, active && { color: '#fff' }]}>
                        {PRIORITY_LABELS[p]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.createBtn, creating && styles.createBtnDisabled]}
                onPress={createTask}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.createBtnText}>Create Task</Text>
                    </>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Property Picker */}
      <Modal visible={showPropertyPicker} transparent animationType="fade" onRequestClose={() => setShowPropertyPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Property</Text>
            <ScrollView>
              {properties.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerRow, createPropertyId === p.id && styles.pickerRowActive]}
                  onPress={() => { setCreatePropertyId(p.id); setShowPropertyPicker(false); }}
                >
                  <Text style={[styles.pickerRowText, createPropertyId === p.id && styles.pickerRowTextActive]}>
                    {p.name}
                  </Text>
                  {createPropertyId === p.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPropertyPicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assignee Picker */}
      <Modal visible={showAssigneePicker} transparent animationType="fade" onRequestClose={() => setShowAssigneePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Assign To</Text>
            <ScrollView>
              <TouchableOpacity
                style={[styles.pickerRow, !createAssigneeId && styles.pickerRowActive]}
                onPress={() => { setCreateAssigneeId(null); setShowAssigneePicker(false); }}
              >
                <Text style={[styles.pickerRowText, !createAssigneeId && styles.pickerRowTextActive]}>
                  Unassigned
                </Text>
                {!createAssigneeId && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </TouchableOpacity>
              {staff.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.pickerRow, createAssigneeId === s.id && styles.pickerRowActive]}
                  onPress={() => { setCreateAssigneeId(s.id); setShowAssigneePicker(false); }}
                >
                  <View>
                    <Text style={[styles.pickerRowText, createAssigneeId === s.id && styles.pickerRowTextActive]}>
                      {s.full_name}
                    </Text>
                    <Text style={styles.pickerRowSub}>{s.role.replace('_', ' ')}</Text>
                  </View>
                  {createAssigneeId === s.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowAssigneePicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 8, paddingHorizontal: 4, backgroundColor: Colors.surface, gap: 4,
  },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  tabBadge: {
    backgroundColor: Colors.border, borderRadius: Radius.full,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },

  list: { padding: Spacing.md, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary },
  emptyText: { ...Typography.bodySmall, textAlign: 'center', color: Colors.textMuted },

  taskCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...Shadow.card,
  },
  priorityBar: { width: 4, alignSelf: 'stretch' },
  taskBody: { flex: 1, padding: Spacing.md, gap: 4 },
  taskTopRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  priorityPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  priorityPillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  taskTitle: { ...Typography.body, fontWeight: '600', marginBottom: 2 },
  taskDesc: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { ...Typography.caption },
  dot: { color: Colors.textMuted, fontSize: 12 },
  overdueText: { color: Colors.danger, fontWeight: '600' },

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

  detailTopRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  detailTitle: { ...Typography.h2, marginBottom: 6 },
  detailDesc: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  detailMeta: { gap: 6, marginBottom: Spacing.sm },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailMetaText: { ...Typography.bodySmall, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },
  statusActions: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  statusActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: Radius.md, borderWidth: 2, paddingVertical: 10,
  },
  statusActionText: { fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.danger,
    paddingVertical: 12, marginBottom: Spacing.sm,
  },
  deleteBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { ...Typography.body, color: Colors.textSecondary },

  inputLabel: { ...Typography.label, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 10,
    ...Typography.body, color: Colors.textPrimary,
  },
  inputMulti: {
    backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 10,
    ...Typography.body, color: Colors.textPrimary, minHeight: 72, textAlignVertical: 'top',
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
  },
  pickerBtnText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  priorityGrid: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  priorityChip: {
    flex: 1, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 8, alignItems: 'center', backgroundColor: Colors.surface,
  },
  priorityChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, height: 52, marginTop: Spacing.md,
  },
  createBtnDisabled: { backgroundColor: Colors.textMuted },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.lg },
  pickerCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, maxHeight: '70%',
  },
  pickerTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: Spacing.sm, borderRadius: Radius.md,
  },
  pickerRowActive: { backgroundColor: Colors.primary + '12' },
  pickerRowText: { ...Typography.body, color: Colors.textPrimary },
  pickerRowTextActive: { color: Colors.primary, fontWeight: '600' },
  pickerRowSub: { ...Typography.caption, textTransform: 'capitalize' },
  pickerCancel: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: 4 },
});
