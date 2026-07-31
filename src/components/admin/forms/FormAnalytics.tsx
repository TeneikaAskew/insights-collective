// ABOUTME: Form analytics dashboard displaying real metrics from forms and form_submissions tables.
// ABOUTME: Shows total forms, submissions, per-form submission counts, and submission trends over time.

import React, { useState, useEffect } from 'react';
import { CHART_COLORS } from '@/lib/chartColors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, subHours, subMonths, startOfDay, parseISO } from 'date-fns';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FormAnalytics');

const COLORS = CHART_COLORS;

const getTimeframeStart = (timeframe: string): Date => {
  const now = new Date();
  switch (timeframe) {
    case 'day': return subHours(now, 24);
    case 'week': return subDays(now, 7);
    case 'month': return subDays(now, 30);
    case 'quarter': return subDays(now, 90);
    case 'year': return subMonths(now, 12);
    default: return subDays(now, 7);
  }
};

const FormAnalytics = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');
  const { toast } = useToast();
  const [formStats, setFormStats] = useState({
    totalForms: 0,
    activeForms: 0,
    totalSubmissions: 0,
    submissionsInPeriod: 0,
  });
  const [submissionData, setSubmissionData] = useState<any[]>([]);
  const [formDistribution, setFormDistribution] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const timeframeStart = getTimeframeStart(selectedTimeframe);
        const timeframeISO = timeframeStart.toISOString();

        // Fetch forms
        const { data: forms, error: formsError } = await supabase
          .from('forms')
          .select('id, title, status');
        
        if (formsError) throw formsError;
        
        // Fetch all submissions
        const { data: submissions, error: submissionsError } = await supabase
          .from('form_submissions')
          .select('id, form_id, created_at');
          
        if (submissionsError) throw submissionsError;
        
        // Calculate stats
        const activeForms = forms?.filter(form => form.status) || [];
        const submissionsInPeriod = submissions?.filter(
          s => s.created_at && s.created_at >= timeframeISO
        ) || [];

        setFormStats({
          totalForms: forms?.length || 0,
          activeForms: activeForms.length,
          totalSubmissions: submissions?.length || 0,
          submissionsInPeriod: submissionsInPeriod.length,
        });

        // Build real submission trends grouped by day
        const dayMap: Record<string, number> = {};
        const days = selectedTimeframe === 'day' ? 1 : selectedTimeframe === 'week' ? 7 : selectedTimeframe === 'month' ? 30 : selectedTimeframe === 'quarter' ? 90 : 365;
        
        for (let i = days - 1; i >= 0; i--) {
          const day = startOfDay(subDays(new Date(), i));
          const label = days <= 7 
            ? format(day, 'EEE') 
            : days <= 30 
              ? format(day, 'MMM d') 
              : format(day, 'MMM d');
          dayMap[label] = 0;
        }

        submissionsInPeriod.forEach(s => {
          if (!s.created_at) return;
          const day = startOfDay(parseISO(s.created_at));
          const label = days <= 7
            ? format(day, 'EEE')
            : format(day, 'MMM d');
          if (label in dayMap) {
            dayMap[label]++;
          }
        });

        setSubmissionData(
          Object.entries(dayMap).map(([name, submissions]) => ({ name, submissions }))
        );

        // Build real form distribution (submissions per form)
        const formSubmissionCounts: Record<string, number> = {};
        const formNameMap: Record<string, string> = {};
        forms?.forEach(f => { formNameMap[f.id] = f.title; });

        submissions?.forEach(s => {
          if (!s.form_id) return;
          formSubmissionCounts[s.form_id] = (formSubmissionCounts[s.form_id] || 0) + 1;
        });

        const distribution = Object.entries(formSubmissionCounts)
          .map(([formId, value]) => ({
            name: formNameMap[formId] || 'Unknown Form',
            value,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        // Include forms with 0 submissions if we have fewer than 5 entries
        if (distribution.length < 5 && forms) {
          const includedIds = new Set(Object.keys(formSubmissionCounts));
          forms
            .filter(f => !includedIds.has(f.id))
            .slice(0, 5 - distribution.length)
            .forEach(f => distribution.push({ name: f.title, value: 0 }));
        }

        setFormDistribution(distribution);
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        toast({
          title: "Error",
          description: "Failed to load analytics data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [toast, selectedTimeframe]);
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-8 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent className="h-80">
            <Skeleton className="h-full w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Form Analytics</h2>
        <div className="flex items-center space-x-2">
          <Label htmlFor="timeframe">Timeframe:</Label>
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-[180px]" id="timeframe">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formStats.totalForms}</div>
            <p className="text-xs text-muted-foreground">
              {formStats.activeForms} active forms
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formStats.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">
              {formStats.submissionsInPeriod} in selected period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Submissions per Form</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formStats.totalForms > 0 
                ? (formStats.totalSubmissions / formStats.totalForms).toFixed(1) 
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all forms
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="submissions" className="w-full">
        <TabsList>
          <TabsTrigger value="submissions">Submission Trends</TabsTrigger>
          <TabsTrigger value="distribution">Submissions by Form</TabsTrigger>
        </TabsList>
        
        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Submission Trends</CardTitle>
              <CardDescription>Real submissions over the selected period</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={submissionData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="submissions" fill="hsl(var(--primary))" name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Submissions by Form</CardTitle>
              <CardDescription>How submissions are distributed across your forms</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {formDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {formDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-full">
                  <p className="text-muted-foreground">No submission data available yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FormAnalytics;
