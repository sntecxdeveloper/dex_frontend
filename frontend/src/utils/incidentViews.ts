import type { ItsmTicket } from '../types';

export interface IncidentView {
  slug: string;
  label: string;
  /** Null for the pages that aren't a plain incident list (Create New, Overview). */
  matches: ((t: ItsmTicket, username: string) => boolean) | null;
}

const isOpen = (t: ItsmTicket) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';

// The backend has no outage flag or location data yet: "Current Outages" and the
// "Critical Incidents Map" both list the open critical-priority incidents.
export const INCIDENT_VIEWS: IncidentView[] = [
  { slug: 'current-outages', label: 'Current Outages', matches: (t) => t.priority === 'CRITICAL' && isOpen(t) },
  { slug: 'create-new', label: 'Create New', matches: null },
  { slug: 'assigned-to-me', label: 'Assigned to me', matches: (t, u) => t.assignedTo === u && isOpen(t) },
  { slug: 'open', label: 'Open', matches: isOpen },
  { slug: 'open-unassigned', label: 'Open - Unassigned', matches: (t) => isOpen(t) && !t.assignedTo },
  { slug: 'resolved', label: 'Resolved', matches: (t) => t.status === 'RESOLVED' },
  { slug: 'closed', label: 'Closed', matches: (t) => t.status === 'CLOSED' },
  { slug: 'all', label: 'All', matches: () => true },
  { slug: 'overview', label: 'Overview', matches: null },
  { slug: 'critical-incidents-map', label: 'Critical Incidents Map', matches: (t) => t.priority === 'CRITICAL' && isOpen(t) },
];
