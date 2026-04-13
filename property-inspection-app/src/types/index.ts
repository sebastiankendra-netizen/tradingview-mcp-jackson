export type UserRole = 'manager' | 'inspector' | 'maintenance_tech';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  push_token?: string;
  created_at: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  photo_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export type ChecklistStatus = 'pass' | 'fail' | 'na' | 'pending';
export type InspectionStatus = 'in_progress' | 'submitted';
export type IssueStatus = 'open' | 'done';

export interface ItemPhoto {
  id: string;
  checklist_item_id: string;
  storage_path: string;
  uploaded_at: string;
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
  property?: Property;
  inspector?: Profile;
  checklist_items?: ChecklistItem[];
}

export interface IssuePhoto {
  id: string;
  issue_id: string;
  storage_path: string;
  uploaded_at: string;
  publicUrl?: string;
}

export interface MaintenanceIssue {
  id: string;
  property_id: string;
  inspection_id?: string;
  checklist_item_id?: string;
  assigned_to?: string;
  title: string;
  description?: string;
  status: IssueStatus;
  resolution_notes?: string;
  created_by: string;
  resolved_at?: string;
  created_at: string;
  property?: Property;
  assignee?: Profile;
  photos?: IssuePhoto[];
}

export interface PropertyAssignment {
  id: string;
  property_id: string;
  inspector_id: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'ondemand';
  next_due_date?: string;
  is_active: boolean;
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
  InspectionDetail: { inspectionId: string };
  AllIssues: undefined;
};

export type InspectorStackParamList = {
  MyProperties: undefined;
  ConductInspection: { propertyId: string; inspectionId?: string };
};

export type MaintenanceStackParamList = {
  MyIssues: undefined;
  IssueDetail: { issueId: string };
};
