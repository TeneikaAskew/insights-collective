// ABOUTME: Admin activity log page showing real security events from the database
// ABOUTME: Replaces hardcoded mock data with live security_events table queries

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEntry {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: string;
  description: string;
  created_at: string;
}

const AdminActivity = () => {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const { data, error } = await supabase
          .from('security_events')
          .select('id, user_id, event_type, severity, description, created_at')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setActivities(data || []);
      } catch (err: any) {
        // A failed fetch must not render as "No activities found".
        console.error('Error fetching activities:', err);
        setLoadError(err?.message || 'Failed to load activity log');
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [reloadKey]);

  const filteredActivities = activities.filter(a =>
    a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.event_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const exportCsv = () => {
    const header = ['Time', 'Event type', 'Severity', 'Description'];
    const rows = filteredActivities.map((a) => [
      new Date(a.created_at).toISOString(),
      a.event_type ?? '',
      a.severity ?? '',
      a.description ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredActivities.length === 0}>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-xl">Recent Activity</CardTitle>
            <CardDescription>
              A log of all recent security events on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading activities...</div>
            ) : loadError ? (
              <div className="text-center py-8" role="alert">
                <p className="text-destructive font-medium mb-1">Failed to load activity log</p>
                <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                  Retry
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No activities found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">{activity.event_type}</TableCell>
                        <TableCell className="max-w-md truncate">{activity.description}</TableCell>
                        <TableCell>
                          <Badge variant={getSeverityVariant(activity.severity) as any}>
                            {activity.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {activity.created_at
                            ? formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
};

export default AdminActivity;
