import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** What one person may see and use (GET /access/me). */
export interface MyAccess {
  roleId: number | null;
  roleName: string;
  baseRole: string;
  pages: Record<string, 'HIDDEN' | 'VIEW' | 'FULL'>;
  actions: Record<string, boolean>;
}

export interface AccessRole {
  id: number;
  name: string;
  description?: string | null;
  baseRole: string;
  builtIn: boolean;
  people: number;
  updatedAt?: string;
}

/** A page's value is HIDDEN, VIEW or FULL; an action's is ALLOW or DENY. */
export interface AccessEntry {
  key: string;
  value: string;
  explicit: boolean;
  required: boolean;
}

export interface CatalogItem {
  key: string;
  label: string;
  kind: 'PAGE' | 'ACTION';
  page: string;
}

export interface AccessPerson {
  username: string;
  fullName?: string | null;
  signInRole?: string | null;
  roleId?: number | null;
  roleName?: string | null;
  exceptions: number;
}

export async function getMyAccess(): Promise<MyAccess> {
  const response = await api.get<ApiResponse<MyAccess>>('/access/me');
  return response.data.data;
}

export async function getAccessCatalog(): Promise<CatalogItem[]> {
  const response = await api.get<ApiResponse<CatalogItem[]>>('/access/catalog');
  return response.data.data;
}

export async function getAccessRoles(): Promise<AccessRole[]> {
  const response = await api.get<ApiResponse<AccessRole[]>>('/access/roles');
  return response.data.data;
}

export async function createAccessRole(input: { name: string; description?: string; baseRole: string; copyFrom?: number }): Promise<AccessRole> {
  const response = await api.post<ApiResponse<AccessRole>>('/access/roles', input);
  return response.data.data;
}

export async function deleteAccessRole(id: number): Promise<void> {
  await api.delete(`/access/roles/${id}`);
}

export async function getRoleGrants(id: number): Promise<AccessEntry[]> {
  const response = await api.get<ApiResponse<AccessEntry[]>>(`/access/roles/${id}/grants`);
  return response.data.data;
}

export async function setRoleGrants(id: number, grants: { key: string; level: string; required: boolean }[]): Promise<AccessEntry[]> {
  const response = await api.put<ApiResponse<AccessEntry[]>>(`/access/roles/${id}/grants`, grants);
  return response.data.data;
}

export async function getAccessPeople(): Promise<AccessPerson[]> {
  const response = await api.get<ApiResponse<AccessPerson[]>>('/access/people');
  return response.data.data;
}

export async function assignAccessRole(username: string, roleId: number): Promise<AccessPerson> {
  const response = await api.put<ApiResponse<AccessPerson>>(`/access/people/${encodeURIComponent(username)}/role`, { roleId });
  return response.data.data;
}
