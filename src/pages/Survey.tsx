
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { FormData } from '@/types/forms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Star } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

const Survey = () => {
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveForms();
  }, []);

  const fetchActiveForms = async () => {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('status', true) // Only show active forms
        .order('featured', { ascending: false }) // Featured forms first
        .order('created_at', { ascending: false }); // Then by creation date

      if (error) {
        console.error('Error fetching forms:', error);
        return;
      }

      setForms(data || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSurvey = (slug: string) => {
    navigate(`/survey/${slug}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container py-8 flex justify-center">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (forms.length === 0) {
    return (
      <AppLayout>
        <div className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>No Surveys Available</CardTitle>
              <CardDescription>
                There are currently no active surveys available.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-4">Available Surveys</h1>
            <p className="text-lg text-muted-foreground">
              Complete our surveys to help us serve you better
            </p>
          </div>

          <div className="grid gap-6">
            {forms.map((form) => (
              <Card 
                key={form.id} 
                className={form.featured ? "border-2 border-primary shadow-lg" : "border"}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {form.featured && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Featured
                        </Badge>
                      )}
                      <Badge variant="default">Active</Badge>
                    </div>
                  </div>
                  <CardTitle className="text-2xl">{form.title}</CardTitle>
                  {form.description && (
                    <CardDescription className="text-base">
                      {form.description}
                    </CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Created {new Date(form.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Est. 10-15 minutes</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Open to all users</span>
                    </div>
                  </div>

                  {form.deadline && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 font-medium">
                        Deadline: {new Date(form.deadline).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button 
                      onClick={() => handleStartSurvey(form.slug || '')}
                      size="lg"
                      className="w-full"
                      disabled={!form.slug}
                    >
                      Start Survey
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Survey;
