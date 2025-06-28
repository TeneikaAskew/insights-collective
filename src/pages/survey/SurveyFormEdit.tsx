
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import FormBuilder from '@/components/forms/builder';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FormStructure } from '@/types/forms';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { createFellowshipForm } from '@/components/forms/builder';

export default function SurveyFormEdit() {
  const { user, isAdmin } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  // Fix: Use surveySlug to match the route parameter name
  const { surveySlug } = useParams<{ surveySlug: string }>();
  const actualSlug = slug || surveySlug;
  const location = useLocation();
  const [formData, setFormData] = useState<{
    id: string;
    title: string;
    description: string;
    status: boolean;
    slug: string;
    form_structure?: FormStructure;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Check if we're viewing submissions based on the URL query parameters
    const searchParams = new URLSearchParams(location.search);
    const isSubmissionsView = searchParams.get('view') === 'submissions';

  useEffect(() => {
    // If user is not admin, we'll let the ProtectedRoute handle the redirect
    if (!user || !isAdmin) {
      return;
    }

    const fetchForm = async () => {
      if (!actualSlug) {
        setError("No form slug provided");
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching form data for slug:", actualSlug);
        const { data, error: fetchError } = await supabase
          .from('forms')
          .select('*')
          .eq('slug', actualSlug)
          .single();

        if (fetchError) {
          console.error("Supabase error:", fetchError);
          
          // If the form doesn't exist and the slug is ai-fellowship, create it
          if (fetchError.code === 'PGRST116' && actualSlug === 'ai-fellowship') {
            console.log("Creating fellowship form...");
            const fellowshipForm = createFellowshipForm();
            
            // Log the form for debugging
            console.log("Fellowship form to be inserted:", fellowshipForm);
            
            // Insert the fellowship form into the database
            const { data: insertedForm, error: insertError } = await supabase
              .from('forms')
              .insert(fellowshipForm)
              .select()
              .single();
              
            if (insertError) {
              console.error("Error inserting fellowship form:", insertError);
              setError(`Error creating fellowship form: ${insertError.message}`);
              setLoading(false);
              return;
            }

            console.log("Fellowship form created successfully:", insertedForm);
            
            setFormData({
              id: insertedForm.id,
              title: insertedForm.title,
              description: insertedForm.description || '',
              status: Boolean(insertedForm.status),
              slug: insertedForm.slug,
              form_structure: insertedForm.form_structure
            });
            
            toast({
              title: 'Fellowship Form Created',
              description: 'The AI & Automation Skills Fellowship form has been created.',
            });
            
            setLoading(false);
            return;
          }
          
          setError(`Error loading form: ${fetchError.message}`);
          throw fetchError;
        }

        if (!data) {
          console.error("No data returned for slug:", actualSlug);
          setError(`Form with slug "${actualSlug}" not found`);
          setLoading(false);
          return;
        }

        console.log("Form data retrieved:", data);

        // Initialize form structure with safe defaults
        const safeFormStructure: FormStructure = {
          sections: Array.isArray(data.form_structure?.sections) ? 
            data.form_structure.sections : []
        };

        setFormData({
          id: data.id,
          title: data.title || '',
          description: data.description || '',
          status: Boolean(data.status),
          slug: data.slug,
          form_structure: safeFormStructure
        });
      } catch (error: any) {
        console.error('Error fetching form:', error);
        toast({
          title: 'Error',
          description: 'Could not load form data: ' + (error.message || 'Unknown error'),
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [actualSlug, toast, user, isAdmin]);

  // Only allow admin users to access this page, but don't redirect immediately
  // to allow the auth system to properly store the redirect path
  if (!user || !isAdmin) {
    console.log("User not authenticated as admin, will be handled by ProtectedRoute");
    return null; // Let ProtectedRoute handle the redirect
  }

  // Show loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-muted-foreground">Loading form data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <AppLayout>
        <div className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>We encountered a problem loading the form.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-red-500">{error}</p>
              <Button 
                onClick={() => window.location.href = '/admin/forms'}
                className="mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Forms
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-8">
        
        <FormBuilder 
          initialFormData={formData} 
          viewMode={isSubmissionsView}
        />
      </div>
    </AppLayout>
  );
}
