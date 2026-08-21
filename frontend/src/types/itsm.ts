export interface ItsmTicket {
  id: number;
  ticketId: string;
  subject: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignedAgent?: string;
  createdAt: string;
  updatedAt?: string;
  relatedIssueId?: number;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
