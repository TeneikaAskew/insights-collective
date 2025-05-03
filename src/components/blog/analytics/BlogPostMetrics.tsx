
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eye, ThumbsUp, MessageSquare, BarChart2 } from 'lucide-react';
import { BlogAnalytics } from '@/types/blog';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export const MetricCard = ({ title, value, description, icon, trend, trendValue }: MetricCardProps) => {
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
            {trend === 'up' && '↑ '}
            {trend === 'down' && '↓ '}
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface BlogPostMetricsProps {
  analytics: BlogAnalytics;
}

export const BlogPostMetrics = ({ analytics }: BlogPostMetricsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Page Views"
        value={analytics.views}
        description="Total page views"
        icon={<Eye className="h-4 w-4 text-primary" />}
        trend="up"
        trendValue="+5.2% from last month"
      />
      <MetricCard
        title="Unique Visitors"
        value={analytics.uniqueVisitors}
        description="Distinct readers"
        icon={<BarChart2 className="h-4 w-4 text-primary" />}
        trend="up"
        trendValue="+2.1% from last month"
      />
      <MetricCard
        title="Avg. Time on Page"
        value={`${analytics.averageTimeOnPage}s`}
        description="Reading engagement"
        icon={<ThumbsUp className="h-4 w-4 text-primary" />}
        trend={analytics.averageTimeOnPage > 45 ? "up" : "down"}
        trendValue={analytics.averageTimeOnPage > 45 ? "Good engagement" : "Below target"}
      />
      <MetricCard
        title="Conversion Rate"
        value={`${analytics.conversionRate}%`}
        description="Readers who took action"
        icon={<MessageSquare className="h-4 w-4 text-primary" />}
        trend={analytics.conversionRate > 2.5 ? "up" : "down"}
        trendValue={analytics.conversionRate > 2.5 ? "Above target" : "Below target"}
      />
    </div>
  );
};

export const BlogAnalyticsOverview = () => {
  // Sample data - in a real application, this would come from an API
  const sampleAnalytics: BlogAnalytics = {
    views: 3245,
    uniqueVisitors: 1872,
    averageTimeOnPage: 62,
    bounceRate: 42.5,
    conversionRate: 3.2
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Blog Analytics</h2>
        <Button variant="outline" size="sm">
          Last 30 Days
        </Button>
      </div>
      <BlogPostMetrics analytics={sampleAnalytics} />
    </div>
  );
};
