import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AiRecommendation {
  explanation: string;
  recommendations: string[];
  confidence: number;
}

export async function getRecommendation(issueId: number): Promise<AiRecommendation> {
  const response = await api.get<ApiResponse<AiRecommendation>>(`/ai/recommendation/issue/${issueId}`);
  return response.data.data;
}

export async function analyzeIssue(issueId: number): Promise<AiRecommendation> {
  const response = await api.post<ApiResponse<AiRecommendation>>(`/ai/analyze/${issueId}`);
  return response.data.data;
}
