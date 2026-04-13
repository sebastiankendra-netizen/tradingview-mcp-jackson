import { ChecklistCategory } from '../types';

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  {
    name: 'Exterior',
    items: [
      'Roof condition',
      'Gutters & downspouts',
      'Exterior walls / siding',
      'Windows & screens',
      'Entry doors & locks',
      'Driveway & walkways',
      'Landscaping & lawn',
      'Fencing & gates',
    ],
  },
  {
    name: 'Common Areas / Amenities',
    items: [
      'Pool condition & cleanliness',
      'Pool deck & furniture',
      'Parking lot & lighting',
      'Gym / fitness center',
      'Hallways & corridors',
      'Mailbox area',
      'Trash & recycling area',
      'Signage & lighting',
    ],
  },
];

/** Flatten all checklist items with their category and sort order */
export function buildChecklistItems(inspectionId: string) {
  const rows: {
    inspection_id: string;
    category: string;
    item_name: string;
    status: 'pending';
    sort_order: number;
  }[] = [];

  let order = 0;
  for (const cat of CHECKLIST_CATEGORIES) {
    for (const item of cat.items) {
      rows.push({
        inspection_id: inspectionId,
        category: cat.name,
        item_name: item,
        status: 'pending',
        sort_order: order++,
      });
    }
  }
  return rows;
}

export const CONDITION_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

export const CONDITION_COLORS: Record<number, string> = {
  1: '#E74C3C',
  2: '#E67E22',
  3: '#F39C12',
  4: '#27AE60',
  5: '#16A085',
};
