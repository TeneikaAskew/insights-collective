
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageSquare, Users, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const ForumList = () => {
  const { data: forums, isLoading } = useQuery({
    queryKey: ['forums'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forums')
        .select(`
          *,
          course:courses(title, id),
          _count: threads(count)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-6 max-w-5xl">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-96" />
            </div>
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 max-w-5xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Discussion Forums</h1>
            <p className="text-muted-foreground">
              Connect with fellow learners, ask questions, and share knowledge across all courses.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search forums..."
                className="pl-8"
              />
            </div>
            <Button variant="outline">Filter</Button>
          </div>

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Forums</TabsTrigger>
              <TabsTrigger value="active">Most Active</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <div className="grid gap-4">
                {forums?.map((forum) => (
                  <Card key={forum.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl">{forum.title}</CardTitle>
                          <CardDescription>
                            {forum.course?.title && (
                              <Badge variant="secondary" className="mr-2">
                                {forum.course.title}
                              </Badge>
                            )}
                            {forum.description}
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/courses/${forum.course?.id}/forums/${forum.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{forum._count?.threads || 0} threads</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>24 members</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Active today</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="active" className="space-y-4">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Most active forums will be shown here.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="recent" className="space-y-4">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Recently updated forums will be shown here.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default ForumList;
