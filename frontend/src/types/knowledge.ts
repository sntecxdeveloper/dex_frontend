export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string; // Backend returns comma-separated string
  author?: string;
  viewCount?: number;
  createdAt: string;
  updatedAt?: string;
}
