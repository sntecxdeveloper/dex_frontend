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

export async function getTicketById(id: number): Promise<ItsmTicket> {
  const response = await api.get<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}`);
  return response.data.data;
}

export async function updateTicketStatus(id: number, status: string): Promise<ItsmTicket> {
  const response = await api.patch<ApiResponse<ItsmTicket>>(`/itsm/tickets/${id}/status`, { status });
  return response.data.data;
}
