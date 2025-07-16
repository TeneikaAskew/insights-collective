import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  Eye, 
  Users, 
  Clock, 
  TrendingUp,
  Calendar
} from 'lucide-react';
import { getBlogPostAnalytics } from '@/services/blogService';
import { BlogAnalytics } from '@/types/blog';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BlogPostAnalytics');

interface BlogPostAnalyticsProps {
  postId: string;
  postSlug: string;
}

export function BlogPostAnalytics({ postId, postSlug }: BlogPostAnalyticsProps) {
  const [analytics, setAnalytics] = useState<BlogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [postSlug, timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await getBlogPostAnalytics(postSlug, timeframe);
      setAnalytics(data);
    } catch (error) {
      logger.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No analytics data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setTimeframe(period)}
            className={`px-3 py-1 text-sm rounded-md ${
              timeframe === period
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {period === 'all' ? 'All Time' : period.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.views.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueVisitors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +15% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time on Page</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(analytics.averageTimeOnPage / 60)}:{Math.floor(analytics.averageTimeOnPage % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              +5% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.bounceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              -2.1% from last period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traffic Sources</CardTitle>
            <CardDescription>Where your readers are coming from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Direct</span>
                <span className="text-sm font-medium">45%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Search</span>
                <span className="text-sm font-medium">32%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Social Media</span>
                <span className="text-sm font-medium">15%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Referral</span>
                <span className="text-sm font-medium">8%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reading Engagement</CardTitle>
            <CardDescription>How readers interact with your content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Read to end</span>
                <span className="text-sm font-medium">68%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Shared</span>
                <span className="text-sm font-medium">12%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Bookmarked</span>
                <span className="text-sm font-medium">5%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Comments</span>
                <span className="text-sm font-medium">3%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}