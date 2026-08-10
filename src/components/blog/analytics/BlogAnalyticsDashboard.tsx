import { useState, useEffect } from 'react';
import { CHART_COLORS } from '@/lib/chartColors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar,
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Clock, 
  MousePointer,
  MessageSquare,
  Heart
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BlogAnalyticsDashboard');

interface AnalyticsData {
  date: string;
  views: number;
  unique_visitors: number;
  avg_time_on_page: number;
  bounce_rate: number;
}

interface PostMetrics {
  id: string;
  title: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  avg_time_on_page: number;
}

interface ReferrerData {
  source: string;
  visits: number;
  percentage: number;
}

interface BlogAnalyticsDashboardProps {
  postId?: string;
}

export function BlogAnalyticsDashboard({ postId }: BlogAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [topPosts, setTopPosts] = useState<PostMetrics[]>([]);
  const [referrerData, setReferrerData] = useState<ReferrerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalViews: 0,
    totalVisitors: 0,
    avgTimeOnPage: 0,
    bounceRate: 0,
    viewsChange: 0,
    visitorsChange: 0,
    // False when the prior-period query failed, so the cards can say the
    // comparison is unavailable instead of rendering a computed-looking 0.0%.
    comparisonAvailable: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, postId]);

  const getDateRange = () => {
    const end = endOfDay(new Date());
    let start;
    
    switch (timeRange) {
      case '24h':
        start = subDays(end, 1);
        break;
      case '7d':
        start = subDays(end, 7);
        break;
      case '30d':
        start = subDays(end, 30);
        break;
      case '90d':
        start = subDays(end, 90);
        break;
      default:
        start = subDays(end, 7);
    }
    
    return { start: startOfDay(start), end };
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Load analytics data
      let analyticsQuery = supabase
        .from('blog_analytics')
        .select('*')
        .gte('date', start.toISOString())
        .lte('date', end.toISOString())
        .order('date', { ascending: true });

      if (postId) {
        analyticsQuery = analyticsQuery.eq('blog_post_id', postId);
      }

      const { data: analytics, error: analyticsError } = await analyticsQuery;
      if (analyticsError) throw analyticsError;

      // Process analytics data
      const processedData = analytics?.map(item => ({
        date: format(new Date(item.date), 'MMM dd'),
        views: item.views,
        unique_visitors: item.unique_visitors,
        avg_time_on_page: Math.round(Number(item.avg_time_on_page) || 0),
        bounce_rate: item.bounce_rate || 0,
      })) || [];

      setAnalyticsData(processedData);

      // Calculate metrics
      const totalViews = processedData.reduce((sum, item) => sum + item.views, 0);
      const totalVisitors = processedData.reduce((sum, item) => sum + item.unique_visitors, 0);
      const avgTimeOnPage = processedData.length > 0
        ? Math.round(processedData.reduce((sum, item) => sum + item.avg_time_on_page, 0) / processedData.length)
        : 0;
      const avgBounceRate = processedData.length > 0
        ? processedData.reduce((sum, item) => sum + item.bounce_rate, 0) / processedData.length
        : 0;

      // Calculate changes — compare current period to prior period
      const { start: priorStart, end: priorEnd } = (() => {
        const range = getDateRange();
        const duration = range.end.getTime() - range.start.getTime();
        return { start: new Date(range.start.getTime() - duration), end: range.start };
      })();

      let priorQuery = supabase
        .from('blog_analytics')
        .select('views, unique_visitors')
        .gte('date', format(priorStart, 'yyyy-MM-dd'))
        .lte('date', format(priorEnd, 'yyyy-MM-dd'));
      if (postId) priorQuery = priorQuery.eq('blog_post_id', postId);
      const { data: priorData, error: priorError } = await priorQuery;

      // A failed prior-period read produced priorViews = 0, which the deltas
      // below turn into a confident percentage against nothing — rendered as a
      // red "0.0% from previous period" that an author reads as a measured
      // trend. The comparison is optional context, so it degrades rather than
      // failing the page, but the cards have to SAY it is missing; an earlier
      // draft of this fix only logged, which left the same fabricated 0.0% on
      // screen under a comment claiming it had been omitted.
      const comparisonAvailable = !priorError;
      if (priorError) {
        logger.error('Prior-period comparison unavailable; deltas suppressed', priorError);
      }

      const priorViews = priorData?.reduce((s, i) => s + (i.views || 0), 0) || 0;
      const priorVisitors = priorData?.reduce((s, i) => s + (i.unique_visitors || 0), 0) || 0;

      const viewsChange = priorViews > 0 ? ((totalViews - priorViews) / priorViews) * 100 : 0;
      const visitorsChange = priorVisitors > 0 ? ((totalVisitors - priorVisitors) / priorVisitors) * 100 : 0;

      setMetrics({
        totalViews,
        totalVisitors,
        avgTimeOnPage,
        bounceRate: avgBounceRate,
        viewsChange,
        visitorsChange,
        comparisonAvailable,
      });

      // Load top posts if not viewing specific post
      if (!postId) {
        // blog_posts carries two generations of view columns. Everything that
        // WRITES uses view_count; views_count is never populated. Reading the
        // dead column made this dashboard disagree with the posts list, so read
        // the live one and alias it to the shape the UI expects.
        const { data: posts, error: postsError } = await supabase
          .from('blog_posts')
          .select('id, title, view_count, likes_count')
          .eq('status', 'published')
          .order('view_count', { ascending: false })
          .limit(5);

        if (postsError) throw postsError;

        // Use real blog_post_views for per-post metrics
        const topPostsData: PostMetrics[] = [];
        for (const post of posts || []) {
          const { data: viewData } = await supabase
            .from('blog_post_views')
            .select('view_duration')
            .eq('post_id', post.id);

          const { count: commentCount } = await supabase
            .from('blog_comments')
            .select('id', { count: 'exact', head: true })
            .eq('blog_post_id', post.id);

          const avgTime = viewData && viewData.length > 0
            ? Math.round(viewData.reduce((s, v) => s + (v.view_duration || 0), 0) / viewData.length)
            : 0;

          topPostsData.push({
            id: post.id,
            title: post.title,
            views_count: post.view_count || 0,
            likes_count: post.likes_count || 0,
            comments_count: commentCount || 0,
            avg_time_on_page: avgTime,
          });
        }
        setTopPosts(topPostsData);
      }

      // Use real referrer data from blog_post_views if available, otherwise show empty
      const { data: viewsWithReferrer } = await supabase
        .from('blog_analytics')
        .select('referrer_data')
        .not('referrer_data', 'is', null)
        .limit(100);

      if (viewsWithReferrer && viewsWithReferrer.length > 0) {
        // Aggregate referrer data from blog_analytics
        const referrerMap: Record<string, number> = {};
        viewsWithReferrer.forEach(row => {
          const data = row.referrer_data as Record<string, number> | null;
          if (data) {
            Object.entries(data).forEach(([source, count]) => {
              referrerMap[source] = (referrerMap[source] || 0) + (typeof count === 'number' ? count : 0);
            });
          }
        });
        const totalReferrers = Object.values(referrerMap).reduce((s, v) => s + v, 0);
        setReferrerData(
          Object.entries(referrerMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([source, visits]) => ({
              source,
              visits,
              percentage: totalReferrers > 0 ? Math.round((visits / totalReferrers) * 1000) / 10 : 0,
            }))
        );
      } else {
        setReferrerData([]);
      }

    } catch (error) {
      logger.error('Error loading analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const COLORS = CHART_COLORS;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Overview</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {!metrics.comparisonAvailable ? (
                <span>Comparison with the previous period is unavailable</span>
              ) : metrics.viewsChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-ss-good" />
                  <span className="text-ss-good">+{metrics.viewsChange.toFixed(1)}%</span>
                  from previous period
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-ss-bad" />
                  <span className="text-ss-bad">{metrics.viewsChange.toFixed(1)}%</span>
                  from previous period
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalVisitors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {!metrics.comparisonAvailable ? (
                <span>Comparison with the previous period is unavailable</span>
              ) : metrics.visitorsChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-ss-good" />
                  <span className="text-ss-good">+{metrics.visitorsChange.toFixed(1)}%</span>
                  from previous period
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-ss-bad" />
                  <span className="text-ss-bad">{metrics.visitorsChange.toFixed(1)}%</span>
                  from previous period
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time on Page</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.avgTimeOnPage)}</div>
            <p className="text-xs text-muted-foreground">
              Average reading time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.bounceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Single page sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="traffic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          {!postId && <TabsTrigger value="top-posts">Top Posts</TabsTrigger>}
          <TabsTrigger value="referrers">Referrers</TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Overview</CardTitle>
              <CardDescription>
                Page views and unique visitors over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--ss-lav-deep))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--ss-lav-deep))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--ss-teal))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--ss-teal))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--ss-lav-deep))"
                    fillOpacity={1}
                    fill="url(#colorViews)"
                    name="Page Views"
                  />
                  <Area
                    type="monotone"
                    dataKey="unique_visitors"
                    stroke="hsl(var(--ss-teal))"
                    fillOpacity={1}
                    fill="url(#colorVisitors)"
                    name="Unique Visitors"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement</CardTitle>
              <CardDescription>
                Average time on page and bounce rate trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avg_time_on_page"
                    stroke="hsl(var(--ss-lav))"
                    name="Avg. Time (seconds)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="bounce_rate"
                    stroke="hsl(var(--ss-bad))"
                    name="Bounce Rate (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {!postId && (
          <TabsContent value="top-posts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Posts</CardTitle>
                <CardDescription>
                  Most viewed posts in the selected time period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPosts.map((post, index) => (
                    <div key={post.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{post.title}</h4>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {post.views_count.toLocaleString()} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {post.likes_count} likes
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {post.comments_count} comments
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(post.avg_time_on_page)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        #{index + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="referrers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
              <CardDescription>
                Where your visitors are coming from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={referrerData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="hsl(var(--ss-lav))"
                      dataKey="visits"
                    >
                      {referrerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {referrerData.map((referrer, index) => (
                    <div key={referrer.source} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{referrer.source}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{referrer.visits.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{referrer.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}