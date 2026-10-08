import api from './axios';
import type { ItsmTicket } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getTickets(): Promise<ItsmTicket[]> {
  const response = await api.get<ApiResponse<ItsmTicket[]>>('/itsm/tickets');
  return response.data.data;
}

export async function getTicketsByIssue(issueId: number): Promise<ItsmTicket[]> {
  const response = await api.get<ApiResponse<ItsmTicket[]>>('/itsm/tickets', { params: { issueId } });
  return response.data.data;
}

export async function getTicketById(id: number): Promise<ItsmTicket> {
  const response = await api.get<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}`);
  return response.data.data;
}

export async function updateTicketStatus(id: number, status: string): Promise<ItsmTicket> {
  const response = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}/status`, { status });
  return response.data.data;
}

export async function createTicket(payload: {
  issueId?: number;
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  /** The requester's email address, kept on the ticket so it can be mailed from any browser. */
  requester?: string;
  /** Optional custom number; the backend generates one when omitted. */
  ticketCode?: string;
}): Promise<ItsmTicket> {
  const response = await api.post<ApiResponse<ItsmTicket>>('/itsm/tickets', payload);
  return response.data.data;
}

/** Fills the email template with this ticket's own data (server side) and sends it to `to`, or to the requester. */
export async function emailTicket(
  id: number,
  payload: { to: string[]; subject: string; body: string; vars?: Record<string, string> },
): Promise<string> {
  const response = await api.post<ApiResponse<null>>(`/itsm/tickets/${id}/email`, payload);
  return response.data.message;
}

/** Expects PATCH /itsm/tickets/{id}/assign { assignedTo }, mirroring PATCH /issues/{id}/assign. */
export async function assignTicket(id: number, assignedTo: string): Promise<ItsmTicket> {
  const response = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}/assign`, { assignedTo });
  return response.data.data;
}
