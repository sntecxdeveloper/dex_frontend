import api from './axios';
import type { KnowledgeArticle } from '../types';

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
