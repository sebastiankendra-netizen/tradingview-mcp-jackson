export type UserRole = 'manager' | 'inspector' | 'maintenance_tech';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  push_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  unit_count?: number;
  photo_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  uploaded_by?: string;
  storage_path: string;
  file_name?: string;
  caption?: string;
  uploaded_at: string;
  publicUrl?: string;
}

export type ChecklistStatus = 'pass' | 'fail' | 'na' | 'pending';
export type InspectionStatus = 'in_progress' | 'submitted';
export type IssueStatus = 'open' | 'pending_review' | 'done';
export type AssignmentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'ondemand';

export interface ItemPhoto {
  id: string;
  checklist_item_id: string;
  inspection_id: string;
  uploaded_by?: string;
  storage_path: string;
  file_name?: string;
  caption?: string;
  uploaded_at: string;
  updated_at: string;
  publicUrl?: string;
}

export interface ChecklistItem {
  id: string;
  inspection_id: string;
  category: string;
  item_name: string;
  status: ChecklistStatus;
  notes?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  photos?: ItemPhoto[];
}

export interface Inspection {
  id: string;
  property_id: string;
  inspector_id: string;
  status: InspectionStatus;
  condition_score?: number;
  notes?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  inspector?: Profile;
  checklist_items?: ChecklistItem[];
}

export interface IssuePhoto {
  id: string;
  issue_id: string;
  uploaded_by?: string;
  storage_path: string;
  file_name?: string;
  photo_type: 'before' | 'after';
  uploaded_at: string;
  publicUrl?: string;
}

export interface MaintenanceIssue {
  id: string;
  property_id: string;
  inspection_id?: string;
  checklist_item_id?: string;
  assigned_to?: string;
  created_by: string;
  title: string;
  description?: string;
  priority: IssuePriority;
  status: IssueStatus;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  assignee?: Profile;
  photos?: IssuePhoto[];
}

export interface PropertyAssignment {
  id: string;
  property_id: string;
  inspector_id: string;
  frequency: AssignmentFrequency;
  next_due_date?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  inspector?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'inspection_assigned' | 'inspection_submitted' | 'issue_assigned';
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  created_at: string;
}

export interface ChecklistCategory {
  name: string;
  items: string[];
}

// Navigation param types
export type RootStackParamList = {
  Login: undefined;
  ManagerTabs: undefined;
  InspectorTabs: undefined;
  MaintenanceTabs: undefined;
};

export type ManagerStackParamList = {
  Dashboard: undefined;
  Properties: undefined;
  PropertyDetail: { propertyId: string };
  AddProperty: undefined;
  ConductInspection: { propertyId: string; inspectionId?: string };
  InspectionDetail: { inspectionId: string };
  AllIssues: undefined;
  AddIssue: undefined;
};

export type InspectorStackParamList = {
  MyProperties: undefined;
  ConductInspection: { propertyId: string; inspectionId?: string };
};

export type MaintenanceStackParamList = {
  MyIssues: undefined;
  IssueDetail: { issueId: string };
};

// Priority display helpers
export const PRIORITY_COLORS: Record<IssuePriority, string> = {
  low:    '#27AE60',
  medium: '#F39C12',
  high:   '#E67E22',
  urgent: '#E74C3C',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
};
