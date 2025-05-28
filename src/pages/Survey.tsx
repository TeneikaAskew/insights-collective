
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { FormData } from '@/types/forms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

const Survey = () => {
  const [featuredForm, setFeaturedForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeaturedForm();
  }, []);

  const fetchFeaturedForm = async () => {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('featured', true)
        .eq('status', true) // Only show active forms
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching featured form:', error);
        // If no featured form, fall back to ai-fellowship
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('forms')
          .select('*')
          .eq('slug', 'ai-fellowship')
          .single();
        
        if (!fallbackError) {
          setFeaturedForm(fallbackData);
        }
      } else if (data) {
        setFeaturedForm(data);
      }
    } catch (error) {
      console.error('Error fetching featured form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSurvey = () => {
    if (featuredForm?.slug) {
      navigate(`/survey/${featuredForm.slug}`);
    }
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

  if (!featuredForm) {
    return (
      <AppLayout>
        <div className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>No Survey Available</CardTitle>
              <CardDescription>
                There are currently no featured surveys available.
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
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-4">Featured Survey</h1>
            <p className="text-lg text-muted-foreground">
              Complete our featured survey to help us serve you better
            </p>
          </div>

          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="default" className="mb-2">Featured</Badge>
                <Badge variant={featuredForm.status ? "default" : "secondary"}>
                  {featuredForm.status ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardTitle className="text-2xl">{featuredForm.title}</CardTitle>
              {featuredForm.description && (
                <CardDescription className="text-base">
                  {featuredForm.description}
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Created {new Date(featuredForm.created_at).toLocaleDateString()}</span>
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

              {featuredForm.deadline && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 font-medium">
                    Deadline: {new Date(featuredForm.deadline).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="pt-4">
                <Button 
                  onClick={handleStartSurvey}
                  size="lg"
                  className="w-full"
                  disabled={!featuredForm.status}
                >
                  Start Survey
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Survey;
