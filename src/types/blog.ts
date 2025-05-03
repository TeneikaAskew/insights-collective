
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
  category?: string;
  status: 'draft' | 'published' | 'archived';
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  views?: number;
  readTime?: number;
}

export interface BlogFormData {
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  imageUrl?: string;
  tags: string[];
  category?: string;
  status: 'draft' | 'published' | 'archived';
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface BlogCategory {
  name: string;
  slug: string;
  description?: string;
  count?: number;
}

interface AnalyticsTrend {
  direction: 'up' | 'down' | 'neutral';
  value: string;
  isPositive?: boolean;
}

export interface BlogAnalytics {
  views: number;
  uniqueVisitors: number;
  averageTimeOnPage: number;
  bounceRate: number;
  conversionRate: number;
  viewsTrend?: AnalyticsTrend;
  visitorsTrend?: AnalyticsTrend;
  timeTrend?: AnalyticsTrend;
  bounceTrend?: AnalyticsTrend;
  conversionTrend?: AnalyticsTrend;
}
