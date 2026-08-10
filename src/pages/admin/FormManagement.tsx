
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FormSubmissionsList from '@/components/admin/forms/FormSubmissionsList';
import FormSubmissionDetail from '@/components/admin/forms/FormSubmissionDetail';
import FormAnalytics from '@/components/admin/forms/FormAnalytics';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormData } from '@/types/forms';
import { ArrowLeft, FileText, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FormManagement');

export default function FormManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [activeTab, setActiveTab] = useState<string>('submissions');
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we have a submissionId in the URL
    const pathSegments = location.pathname.split('/');
    const submissionIdIndex = pathSegments.indexOf('submission');
    
    if (submissionIdIndex !== -1 && pathSegments.length > submissionIdIndex + 1) {
      setSubmissionId(pathSegments[submissionIdIndex + 1]);
    } else {
      setSubmissionId(null);
    }
    
    // Check if we have a tab in the URL
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && ['submissions', 'analytics'].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    // Get form slug from params
    const formSlug = params.slug;
    
    if (formSlug) {
      fetchFormData(formSlug);
    } else {
      setLoading(false);
      setError('No form specified');
    }
  }, [location, params]);

  const fetchFormData = async (slug: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setForm(data as unknown as FormData);
      } else {
        setError('Form not found');
      }
    } catch (error) {
      logger.error('Error fetching form:', error);
      setError('Failed to load form data');
      toast({
        title: "Error",
        description: "Failed to load form data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="h-4" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            {error} <Button variant="link" onClick={() => navigate("/admin/forms")}>Return to forms</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!form) {
    return <Navigate to="/admin/forms" replace />;
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/admin/forms")}
            className="hover:bg-transparent p-0 h-auto"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{form.title}</h1>
            {form.description && (
              <p className="text-muted-foreground mt-1">{form.description}</p>
            )}
          </div>
        </div>

        {submissionId ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/admin/forms/submissions/${form.slug}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to all responses
              </Button>
            </div>
            <FormSubmissionDetail 
              formId={form.id} 
              submissionId={submissionId} 
              form={form} 
            />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="submissions" onClick={() => navigate(`/admin/forms/submissions/${form.slug}?tab=submissions`, { replace: true })}>
                <FileText className="h-4 w-4 mr-2" /> Submissions
              </TabsTrigger>
              <TabsTrigger value="analytics" onClick={() => navigate(`/admin/forms/submissions/${form.slug}?tab=analytics`, { replace: true })}>
                <BarChart className="h-4 w-4 mr-2" /> Analytics
              </TabsTrigger>
            </TabsList>
            <TabsContent value="submissions" className="space-y-4">
              <FormSubmissionsList formId={form.id} formSlug={form.slug} />
            </TabsContent>
            <TabsContent value="analytics" className="space-y-4">
              <FormAnalytics />
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}
