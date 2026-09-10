export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string; // Backend returns comma-separated string
  author?: string;
  viewCount?: number;
  status?: string; // DRAFT | PUBLISHED | ARCHIVED
  approvalStatus?: string; // PENDING_REVIEW | APPROVED
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KnowledgeScript {
  id: number;
  articleId?: number | null;
  title: string;
  description?: string;
  language?: string;
  content: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KnowledgeScreenshot {
  id: number;
  articleId: number;
  caption?: string;
  imageData: string;
  createdAt: string;
}
