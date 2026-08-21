import api from './axios';
import type { Issue } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getIssues(params?: { severity?: string; status?: string }): Promise<Issue[]> {
  const response = await api.get<ApiResponse<Issue[]>>('/issues', { params });
  return response.data.data;
}

export async function getIssueById(id: number): Promise<Issue> {
  const response = await api.get<ApiResponse<Issue>>(`/issues/${id}`);
  return response.data.data;
}

export async function updateIssueStatus(id: number, status: string): Promise<Issue> {
  const response = await api.patch<ApiResponse<Issue>>(`/issues/${id}/status`, { status });
  return response.data.data;
}

export async function assignIssue(id: number, assignedTo: string): Promise<Issue> {
  const response = await api.patch<ApiResponse<Issue>>(`/issues/${id}/assign`, { assignedTo });
  return response.data.data;
}
