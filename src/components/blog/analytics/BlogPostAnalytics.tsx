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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueVisitors.toLocaleString()}</div>
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
            <p className="text-xs text-muted-foreground">Average reading time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Readers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueVisitors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Distinct visitors recorded</p>
          </CardContent>
        </Card>
      </div>

      {/*
        Removed: period-over-period deltas ("+20.1% from last period"), a Traffic
        Sources card and a Reading Engagement card. Every number in them was a
        hardcoded literal, not a measurement — they reported the same figures for
        every post regardless of its real traffic. The Bounce Rate tile went too:
        blogService.getBlogPostAnalytics returns a literal 0 for it, with the
        comment "No real data source for bounce rate yet", so it always rendered
        0.0%. Restore each one when there is a real source behind it.
      */}
    </div>
  );
}