
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, ThumbsUp, MessageSquare, BarChart2, Calendar, ArrowUp, ArrowDown, Minus, Share2 } from 'lucide-react';
import { BlogAnalytics } from '@/types/blog';
import { formatDistanceToNow, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { getBlogPostAnalytics } from '@/services/blogService';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export const MetricCard = ({ title, value, description, icon, trend, trendValue }: MetricCardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <ArrowDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${
            trend === 'up' ? 'text-green-500' : 
            trend === 'down' ? 'text-red-500' : 'text-gray-500'
          }`}>
            {getTrendIcon()}
            <span className="ml-1">{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface BlogPostMetricsProps {
  slug?: string; // Post slug for single post analytics
  timeframe?: '7d' | '30d' | '90d' | 'all';
}

export const BlogPostMetrics = ({ slug, timeframe = '30d' }: BlogPostMetricsProps) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>(timeframe);
  
  // Fetch analytics data
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['blog-analytics', slug, selectedTimeframe],
    queryFn: () => getBlogPostAnalytics(slug, selectedTimeframe),
  });
  
  const timeframeOptions = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'All Time', value: 'all' }
  ];
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (error || !analytics) {
    return (
      <Card className="p-6">
        <CardTitle className="mb-2">Error Loading Analytics</CardTitle>
        <CardDescription>
          There was a problem loading the blog analytics data. Please try again later.
        </CardDescription>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <div className="flex bg-muted rounded-md p-1">
          {timeframeOptions.map(option => (
            <Button
              key={option.value}
              variant={selectedTimeframe === option.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedTimeframe(option.value as '7d' | '30d' | '90d' | 'all')}
              className="text-xs h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Page Views"
          value={analytics.views}
          description="Total page views"
          icon={<Eye className="h-4 w-4 text-primary" />}
          trend={analytics.viewsTrend?.direction}
          trendValue={analytics.viewsTrend?.value}
        />
        <MetricCard
          title="Unique Visitors"
          value={analytics.uniqueVisitors}
          description="Distinct readers"
          icon={<BarChart2 className="h-4 w-4 text-primary" />}
          trend={analytics.visitorsTrend?.direction}
          trendValue={analytics.visitorsTrend?.value}
        />
        <MetricCard
          title="Avg. Time on Page"
          value={`${analytics.averageTimeOnPage}s`}
          description="Reading engagement"
          icon={<ThumbsUp className="h-4 w-4 text-primary" />}
          trend={analytics.timeTrend?.direction}
          trendValue={analytics.timeTrend?.value}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${analytics.conversionRate}%`}
          description="Readers who took action"
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          trend={analytics.conversionTrend?.direction}
          trendValue={analytics.conversionTrend?.value}
        />
      </div>
    </>
  );
};

export const BlogAnalyticsOverview = () => {
  const timeframeOptions = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'All Time', value: 'all' }
  ];
  
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  // Fetch overall blog analytics data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['blog-analytics-overview', selectedTimeframe],
    queryFn: () => getBlogPostAnalytics(undefined, selectedTimeframe),
  });
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Blog Analytics</h2>
        <div className="flex bg-muted rounded-md p-1">
          {timeframeOptions.map(option => (
            <Button
              key={option.value}
              variant={selectedTimeframe === option.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedTimeframe(option.value as '7d' | '30d' | '90d' | 'all')}
              className="text-xs h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <BlogPostMetrics timeframe={selectedTimeframe} />
      )}
    </div>
  );
};
