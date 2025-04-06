
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, Award, BarChart2 } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  linkTo: string;
  linkText?: string;
}

export const MetricCard = ({ title, value, description, icon, linkTo, linkText = "View all" }: MetricCardProps) => {
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
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
          <Link to={linkTo}>{linkText}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export const AdminDashboardMetrics = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Users"
        value="3,580"
        description="Active platform users"
        icon={<Users className="h-4 w-4 text-primary" />}
        linkTo="/admin/users"
      />
      <MetricCard
        title="Total Courses"
        value="24"
        description="Available courses"
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        linkTo="/admin/courses"
      />
      <MetricCard
        title="Active Enrollments"
        value="1,245"
        description="Current course enrollments"
        icon={<BarChart2 className="h-4 w-4 text-primary" />}
        linkTo="/admin/enrollments"
        linkText="View enrollments"
      />
      <MetricCard
        title="Certificates Issued"
        value="857"
        description="Completion certificates"
        icon={<Award className="h-4 w-4 text-primary" />}
        linkTo="/admin/certificates"
        linkText="View certificates"
      />
    </div>
  );
};
