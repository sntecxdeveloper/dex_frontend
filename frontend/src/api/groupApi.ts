import api from './axios';
import type {
  GroupCandidate,
  GroupDetail,
  GroupDeviceMember,
  GroupPersonMember,
  GroupRequest,
  GroupRule,
  GroupSummary,
  GroupType,
  RuleFieldInfo,
  RulePreview,
} from '../types/group';
import type { BulkRunResult } from '../types/knowledge';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getGroups(type?: GroupType): Promise<GroupSummary[]> {
  const r = await api.get<ApiResponse<GroupSummary[]>>('/groups', { params: type ? { type } : undefined });
  return r.data.data;
}

export async function getGroup(id: number): Promise<GroupDetail> {
  const r = await api.get<ApiResponse<GroupDetail>>(`/groups/${id}`);
  return r.data.data;
}

export async function getGroupDevices(id: number): Promise<GroupDeviceMember[]> {
  const r = await api.get<ApiResponse<GroupDeviceMember[]>>(`/groups/${id}/devices`);
  return r.data.data;
}

export async function getGroupPeople(id: number): Promise<GroupPersonMember[]> {
  const r = await api.get<ApiResponse<GroupPersonMember[]>>(`/groups/${id}/people`);
  return r.data.data;
}

export async function getGroupsOfDevice(agentId: string): Promise<GroupSummary[]> {
  const r = await api.get<ApiResponse<GroupSummary[]>>(`/groups/of-device/${encodeURIComponent(agentId)}`);
  return r.data.data;
}

export async function getRuleFields(type: GroupType): Promise<RuleFieldInfo[]> {
  const r = await api.get<ApiResponse<{ fields: RuleFieldInfo[] }>>('/groups/fields', { params: { type } });
  return r.data.data.fields;
}

export async function previewRule(groupType: GroupType, rule: GroupRule): Promise<RulePreview> {
  const r = await api.post<ApiResponse<RulePreview>>('/groups/preview', { groupType, rule });
  return r.data.data;
}

export async function getCandidates(type: GroupType, q?: string): Promise<GroupCandidate[]> {
  const r = await api.get<ApiResponse<GroupCandidate[]>>('/groups/candidates', { params: { type, q } });
  return r.data.data;
}

export async function createGroup(body: GroupRequest): Promise<GroupDetail> {
  const r = await api.post<ApiResponse<GroupDetail>>('/groups', body);
  return r.data.data;
}

export async function updateGroup(id: number, body: GroupRequest): Promise<GroupDetail> {
  const r = await api.put<ApiResponse<GroupDetail>>(`/groups/${id}`, body);
  return r.data.data;
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`/groups/${id}`);
}

export async function addGroupMembers(id: number, members: string[]): Promise<{ added: number; skipped: string[] }> {
  const r = await api.post<ApiResponse<{ added: number; skipped: string[] }>>(`/groups/${id}/members`, { members });
  return r.data.data;
}

export async function removeGroupMember(id: number, key: string): Promise<void> {
  await api.delete(`/groups/${id}/members/${encodeURIComponent(key)}`);
}

/** Runs an approved fix on every device in the group (the same fleet run as picking devices by hand). */
export async function runScriptOnGroup(
  id: number,
  scriptId: number,
  parameters: Record<string, string | number | boolean> = {},
): Promise<BulkRunResult> {
  const r = await api.post<ApiResponse<BulkRunResult>>(`/groups/${id}/run-script/${scriptId}`, { parameters });
  return r.data.data;
}
