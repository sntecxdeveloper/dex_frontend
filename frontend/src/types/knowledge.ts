export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  author?: string;
  createdAt: string;
  updatedAt?: string;
  relatedIssueIds?: number[];
}
