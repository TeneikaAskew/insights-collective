// ABOUTME: Reusable metric card for the admin dashboard.
// ABOUTME: Values must be provided by callers — never render hardcoded platform stats here.

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  linkTo: string;
  linkText?: string;
}

export const MetricCard = ({ title, value, description, icon, linkTo, linkText = 'View all' }: MetricCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
          <Link to={linkTo}>{linkText}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// The previous AdminDashboardMetrics component rendered hardcoded string values
// (e.g. "3,580 users", "24 courses", "1,245 enrollments", "24/7") that were
// presented as live platform metrics. That misled admins and has been removed.
// AdminDashboard.tsx now fetches real counts via Supabase; use MetricCard above
// directly with real props if you need to render additional KPI cards.
