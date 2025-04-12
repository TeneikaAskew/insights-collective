
export interface BlogPost {
  id: string;  // Changed from number to string to match Supabase's UUID format
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
