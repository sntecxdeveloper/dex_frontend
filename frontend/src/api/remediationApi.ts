import api from './axios';
import type { Remediation } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getRemediations(): Promise<Remediation[]> {
  const response = await api.get<ApiResponse<Remediation[]>>('/remediations');
  return response.data.data;
}

export async function getRemediationById(id: number): Promise<Remediation> {
  const response = await api.get<ApiResponse<Remediation>>(`/remediations/${id}`);
  return response.data.data;
}

export async function getRemediationsByIssueId(issueId: number): Promise<Remediation[]> {
  const response = await api.get<ApiResponse<Remediation[]>>(`/remediations/issue/${issueId}`);
  return response.data.data;
}

export async function executeRemediation(issueId: number, action: string): Promise<Remediation> {
  const response = await api.post<ApiResponse<Remediation>>('/remediations', { issueId, action });
  return response.data.data;
}
