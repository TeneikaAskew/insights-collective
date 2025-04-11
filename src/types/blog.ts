
export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  publishedAt: string;
  updatedAt?: string;
  authorId?: string;
  authorName?: string;
  imageUrl?: string;
  tags: string[];
}

export interface BlogFormData {
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  imageUrl?: string;
  tags: string[];
}
