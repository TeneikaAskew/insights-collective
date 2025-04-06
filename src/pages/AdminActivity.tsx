
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { mockService } from '@/lib/mockData';

const AdminActivity = () => {
  // Mock activity data
  const activities = [
    { id: 1, user: "John Doe", action: "enrolled in Introduction to Data Science", timestamp: "2 hours ago" },
    { id: 2, user: "Jane Smith", action: "created a new course Data Engineering Fundamentals", timestamp: "5 hours ago" },
    { id: 3, user: "John Doe", action: "completed a module in Advanced Machine Learning", timestamp: "1 day" },
    { id: 4, user: "Admin User", action: "issued a certificate to John Doe", timestamp: "2 days ago" },
    { id: 5, user: "Jane Smith", action: "uploaded a new resource", timestamp: "3 days ago" },
    { id: 6, user: "Admin User", action: "approved a new instructor", timestamp: "4 days ago" },
    { id: 7, user: "John Doe", action: "submitted an assignment", timestamp: "5 days ago" },
    { id: 8, user: "Jane Smith", action: "created a new quiz", timestamp: "6 days ago" },
    { id: 9, user: "John Doe", action: "updated profile information", timestamp: "1 week ago" },
    { id: 10, user: "Admin User", action: "deleted an expired event", timestamp: "1 week ago" },
  ];
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Export
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search activities..."
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm">
            Filter
          </Button>
        </div>
        
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-xl">Recent Activity</CardTitle>
            <CardDescription>
              A log of all recent actions and events on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.user}</TableCell>
                    <TableCell>{activity.action}</TableCell>
                    <TableCell>{activity.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminActivity;
