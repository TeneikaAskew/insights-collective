
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import FormEditor from '@/components/survey/FormEditor';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FormStructure } from '@/types/forms';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';

export default function SurveyFormEdit() {
  const { user, isAdmin } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [formData, setFormData] = useState<{
    id: string;
    title: string;
    description: string;
    status: boolean;
    form_structure?: FormStructure;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchForm = async () => {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from('forms')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) throw error;

        // Initialize empty sections array if form_structure is null or undefined
        if (!data.form_structure || !data.form_structure.sections) {
          data.form_structure = { sections: [] };
        }

        setFormData({
          id: data.id,
          title: data.title,
          description: data.description || '',
          status: data.status,
          form_structure: data.form_structure
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
  }, [slug, toast]);

  // Only allow admin users to access this page
  if (!user || !isAdmin) {
    return <Navigate to="/" />;
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

  return (
    <AppLayout>
      <FormEditor initialFormData={formData} />
    </AppLayout>
  );
}
