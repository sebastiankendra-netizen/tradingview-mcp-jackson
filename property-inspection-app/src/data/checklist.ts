import { ChecklistCategory } from '../types';

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  {
    name: 'Exterior',
    items: [
      'Roof condition',
      'Gutters & downspouts',
      'Exterior walls / siding / paint',
      'Foundation & slab',
      'Windows & screens',
      'Entry doors, locks & deadbolts',
      'Driveway & walkways',
      'Landscaping & lawn',
      'Fencing & gates',
      'Exterior lighting',
      'Storm drainage & grading',
    ],
  },
  {
    name: 'Roof & Attic',
    items: [
      'Roof from ground — visible damage or sagging',
      'Soffits & fascia condition',
      'Attic ventilation (if accessible)',
      'Signs of water intrusion / staining on ceilings',
    ],
  },
  {
    name: 'HVAC / Air Conditioning',
    items: [
      'AC unit exterior condition',
      'AC filter — clean & replaced',
      'AC cooling operation (set to 72°F, verify cold air)',
      'Thermostat operation',
      'Supply & return vents — unobstructed & clean',
      'Condensate drain line — clear, no overflow',
      'Refrigerant lines insulation',
    ],
  },
  {
    name: 'Electrical',
    items: [
      'Electrical panel — no tripped breakers, labeled',
      'Outlets & switches — working, no damage',
      'GFCI outlets in kitchen & bathrooms',
      'Interior light fixtures — working',
      'Smoke detectors — present & tested',
      'Carbon monoxide detectors — present & tested',
      'Ceiling fans — operation & condition',
    ],
  },
  {
    name: 'Plumbing',
    items: [
      'Water heater — condition & age visible',
      'Water heater temperature setting (120°F recommended)',
      'Water pressure — adequate at all fixtures',
      'Kitchen sink — no leaks under cabinet',
      'Bathroom sink(s) — no leaks, drains freely',
      'Toilet(s) — no running, secure, flushes properly',
      'Shower/tub — no leaks, drains freely',
      'Caulking & grout — sealed, no mold',
      'Exterior hose bibs / spigots',
    ],
  },
  {
    name: 'Kitchen',
    items: [
      'Cabinets & drawers — working, no damage',
      'Countertops — condition',
      'Refrigerator — operation & cleanliness',
      'Stove / range — all burners working',
      'Oven — operation',
      'Microwave — operation (if provided)',
      'Dishwasher — operation, no leaks',
      'Range hood / exhaust fan',
      'Sink & faucet — no leaks, adequate pressure',
      'Garbage disposal — working',
    ],
  },
  {
    name: 'Bathrooms',
    items: [
      'Toilet — secure, no running, flushes well',
      'Sink & faucet — no leaks, drains freely',
      'Shower / tub — condition, caulking, no leaks',
      'Exhaust fan — working',
      'Mirror & vanity — condition',
      'Flooring — no water damage or loose tiles',
      'Towel bars & toilet paper holder',
    ],
  },
  {
    name: 'Interior — Living Areas',
    items: [
      'Walls & ceilings — no cracks, stains, or holes',
      'Flooring — no damage, loose tiles, or staining',
      'Windows — open/close properly, locks work',
      'Window blinds / treatments — condition',
      'Doors — open/close/lock properly',
      'Closets — condition & cleanliness',
      'Overall cleanliness',
    ],
  },
  {
    name: 'Common Areas / Amenities',
    items: [
      'Hallways & corridors — clean & clear',
      'Stairways — secure railings, no damage',
      'Laundry area — equipment working, clean',
      'Mailbox area — condition',
      'Trash & recycling area — clean, no overflow',
      'Parking lot — condition & line markings',
      'Parking lot lighting',
      'Signage — visible & in good condition',
    ],
  },
  {
    name: 'Pool / Outdoor Amenities',
    items: [
      'Pool water clarity & chemical balance',
      'Pool equipment (pump, filter) — operation',
      'Pool deck — clean, no cracks or trip hazards',
      'Pool fence / barrier — secure, gate latches',
      'Pool furniture — condition',
      'Outdoor lighting at pool area',
    ],
  },
  {
    name: 'Safety & Compliance',
    items: [
      'Fire extinguisher — present, charged & accessible',
      'Exit signage — visible',
      'Emergency lighting — working',
      'No pest / rodent evidence',
      'No mold or mildew visible',
      'No standing water or moisture issues',
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
