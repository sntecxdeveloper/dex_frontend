import api from './axios';
import type { KnowledgeArticle, KnowledgeScript, KnowledgeScreenshot } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getArticles(params?: { search?: string; category?: string }): Promise<KnowledgeArticle[]> {
  const response = await api.get<ApiResponse<KnowledgeArticle[]>>('/knowledge', { params });
  return response.data.data;
}

export async function getArticleById(id: number): Promise<KnowledgeArticle> {
  const response = await api.get<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}`);
  return response.data.data;
}

export interface CreateArticleInput {
  title: string;
  content?: string;
  category?: string;
  tags?: string;
  author?: string;
  status?: string;
}

export async function createArticle(input: CreateArticleInput): Promise<KnowledgeArticle> {
  const response = await api.post<ApiResponse<KnowledgeArticle>>('/knowledge', input);
  return response.data.data;
}

export async function deleteArticle(id: number): Promise<void> {
  await api.delete(`/knowledge/${id}`);
}

export async function approveArticle(id: number): Promise<KnowledgeArticle> {
  const response = await api.post<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}/approve`);
  return response.data.data;
}

export async function revokeApproval(id: number): Promise<KnowledgeArticle> {
  const response = await api.post<ApiResponse<KnowledgeArticle>>(`/knowledge/${id}/revoke-approval`);
  return response.data.data;
}

export async function getAllScripts(): Promise<KnowledgeScript[]> {
  const response = await api.get<ApiResponse<KnowledgeScript[]>>('/knowledge/scripts');
  return response.data.data;
}

export async function getScriptsByArticle(articleId: number): Promise<KnowledgeScript[]> {
  const response = await api.get<ApiResponse<KnowledgeScript[]>>(`/knowledge/${articleId}/scripts`);
  return response.data.data;
}

export interface CreateScriptInput {
  articleId?: number | null;
  title: string;
  description?: string;
  language?: string;
  content: string;
  author?: string;
}

export async function createScript(input: CreateScriptInput): Promise<KnowledgeScript> {
  const response = await api.post<ApiResponse<KnowledgeScript>>('/knowledge/scripts', input);
  return response.data.data;
}

export async function deleteScript(id: number): Promise<void> {
  await api.delete(`/knowledge/scripts/${id}`);
}

export async function getScreenshotsByArticle(articleId: number): Promise<KnowledgeScreenshot[]> {
  const response = await api.get<ApiResponse<KnowledgeScreenshot[]>>(`/knowledge/${articleId}/screenshots`);
  return response.data.data;
}

export async function addScreenshot(articleId: number, caption: string, imageData: string): Promise<KnowledgeScreenshot> {
  const response = await api.post<ApiResponse<KnowledgeScreenshot>>(`/knowledge/${articleId}/screenshots`, {
    caption,
    imageData,
  });
  return response.data.data;
}

export async function deleteScreenshot(id: number): Promise<void> {
  await api.delete(`/knowledge/screenshots/${id}`);
}
