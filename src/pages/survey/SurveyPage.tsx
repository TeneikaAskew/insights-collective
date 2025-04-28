
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FormProvider, useForm } from 'react-hook-form';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import SurveySection from '@/components/survey/SurveySection';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { FormData, FormSection, FormStructure } from '@/types/forms';

export default function SurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formSections, setFormSections] = useState<any[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form setup
  const methods = useForm();
  const { reset, handleSubmit } = methods;

  // Load form data
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

        // Check if form is active
        if (!data.status) {
          toast({
            title: 'Form Unavailable',
            description: 'This form is currently not active.',
            variant: 'destructive'
          });
          navigate('/');
          return;
        }

        setFormData(data);

        if (data.form_structure && data.form_structure.sections) {
          setFormSections(data.form_structure.sections);
        }

        // Load draft data if user is logged in
        if (user?.id && data.id) {
          // Try to load from database first
          const { data: draftData, error: draftError } = await supabase
            .from('survey_drafts')
            .select('form_data')
            .eq('user_id', user.id)
            .eq('form_id', data.id)
            .single();

          if (draftData) {
            reset(draftData.form_data);
            setDraftLoaded(true);
          } else {
            // Fall back to localStorage if no draft in database
            const savedDraft = localStorage.getItem(`survey_draft_${user.id}_${data.id}`);
            if (savedDraft) {
              try {
                const parsedDraft = JSON.parse(savedDraft);
                reset(parsedDraft);
                setDraftLoaded(true);
              } catch (e) {
                console.error("Error parsing saved draft:", e);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching form:', error);
        toast({
          title: 'Error',
          description: 'Could not load form data',
          variant: 'destructive'
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [slug, user, toast, navigate, reset]);

  // Function to go to next section
  const goToNextSection = () => {
    if (currentSectionIndex < formSections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      window.scrollTo(0, 0);
    }
  };

  // Function to go to previous section
  const goToPrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  // Function to handle form submission
  const onSubmit = async (data: any) => {
    if (!formData) return;
    
    setSubmitting(true);
    try {
      const submission = {
        form_id: formData.id,
        user_id: user?.id || null,
        submission_data: data
      };
      
      // Submit form data
      const { error } = await supabase
        .from('form_submissions')
        .insert(submission);
        
      if (error) throw error;
      
      // Delete draft after successful submission
      if (user?.id) {
        // Delete from database
        await supabase
          .from('survey_drafts')
          .delete()
          .eq('user_id', user.id)
          .eq('form_id', formData.id);
          
        // Delete from localStorage
        localStorage.removeItem(`survey_draft_${user.id}_${formData.id}`);
      }
      
      // Redirect to confirmation page
      navigate(`/survey-confirmation/${slug}`);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit form. Please try again.',
        variant: 'destructive'
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container py-10 flex justify-center items-center min-h-[50vh]">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading form...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!formData || formSections.length === 0) {
    return (
      <AppLayout>
        <div className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Form Not Found</CardTitle>
              <CardDescription>
                The form you are looking for does not exist or has no questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const currentSection = formSections[currentSectionIndex];

  return (
    <AppLayout>
      <div className="container max-w-4xl py-10">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl">{formData.title}</CardTitle>
            {formData.description && (
              <CardDescription className="text-base mt-2">
                {formData.description}
              </CardDescription>
            )}
          </CardHeader>
          
          <CardContent>
            <div className="mb-6">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-2 transition-all duration-300 ease-in-out"
                  style={{ width: `${((currentSectionIndex + 1) / formSections.length) * 100}%` }}
                ></div>
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex justify-between">
                <span>Section {currentSectionIndex + 1} of {formSections.length}</span>
                <span>{Math.round(((currentSectionIndex + 1) / formSections.length) * 100)}% complete</span>
              </div>
            </div>
            
            <FormProvider {...methods}>
              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Current section */}
                <SurveySection
                  section={{ 
                    section: currentSection.title, 
                    fields: currentSection.fields.map((field: any) => ({
                      type: field.type,
                      label: field.label,
                      required: field.required,
                      options: field.options,
                      validation: field.validation
                    }))
                  }}
                  formData={methods.getValues()}
                  formId={formData.id}
                />
                
                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPrevSection}
                    disabled={currentSectionIndex === 0}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  
                  {currentSectionIndex < formSections.length - 1 ? (
                    <Button type="button" onClick={goToNextSection}>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
