
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
import { createFellowshipForm } from '@/components/forms/builder';

import { createLogger } from '@/utils/logger';

const logger = createLogger('SurveyPage');

export default function SurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  // Fix: Use surveySlug to match the route parameter name
  const { surveySlug } = useParams<{ surveySlug: string }>();
  const actualSlug = slug || surveySlug;
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
      if (!actualSlug) return;

      try {
        logger.log("Fetching form with slug:", actualSlug);
        // Try to fetch the existing form
        const { data, error } = await supabase
          .from('forms')
          .select('*')
          .eq('slug', actualSlug)
          .eq('status', true) // Only fetch active forms
          .single();

        // If there's an error and the form doesn't exist but the slug is 'ai-fellowship'
        if (error) {
          logger.log("Error fetching form:", error);
          
          if (error.code === 'PGRST116' && slug === 'ai-fellowship') {
            logger.log("Fellowship form not found, creating it...");
            const fellowshipForm = createFellowshipForm();
            
            logger.log("Fellowship form to be created:", fellowshipForm);
            
            // Insert the fellowship form into the database
            const { data: insertedForm, error: insertError } = await supabase
              .from('forms')
              .insert(fellowshipForm)
              .select()
              .single();
              
            if (insertError) {
              logger.error("Error creating fellowship form:", insertError);
              throw insertError;
            }
            
            logger.log("Fellowship form created:", insertedForm);
            setFormData(insertedForm as unknown as FormData);
            
            const insertedFs = insertedForm.form_structure as any;
            if (insertedFs && Array.isArray(insertedFs.sections)) {
              setFormSections(insertedFs.sections);
              logger.log("Set form sections:", insertedFs.sections);
            } else {
              logger.error("Invalid form structure:", insertedForm.form_structure);
            }
            
            toast({
              title: 'Form Created',
              description: 'The fellowship form has been created successfully.',
            });
          } else {
            throw error;
          }
        } else {
          // If form was fetched successfully
          logger.log("Form found:", data);
          
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

          setFormData(data as unknown as FormData);

          const dataFs = data.form_structure as any;
          if (dataFs && Array.isArray(dataFs.sections)) {
            setFormSections(dataFs.sections);
            logger.log("Set form sections:", dataFs.sections);
          } else {
            logger.error("Invalid form structure:", data.form_structure);
          }
        }

        // Load draft data if user is logged in
        if (user?.id && formData?.id) {
          try {
            // Try to load from database first
            const { data: draftData, error: draftError } = await supabase
              .from('survey_drafts')
              .select('form_data')
              .eq('user_id', user.id)
              .eq('form_id', formData.id)
              .single();

            if (draftData) {
              reset(draftData.form_data as any);
              setDraftLoaded(true);
            } else {
              // Fall back to localStorage if no draft in database
              const savedDraft = localStorage.getItem(`survey_draft_${user.id}_${formData.id}`);
              if (savedDraft) {
                try {
                  const parsedDraft = JSON.parse(savedDraft);
                  reset(parsedDraft);
                  setDraftLoaded(true);
                } catch (e) {
                  logger.error("Error parsing saved draft:", e);
                }
              }
            }
          } catch (error) {
            logger.error("Error loading draft:", error);
          }
        }
      } catch (error) {
        logger.error('Error fetching form:', error);
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
  }, [slug, user, toast, navigate]);

  // Function to go to next section
  function goToNextSection() {
    if (currentSectionIndex < formSections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      window.scrollTo(0, 0);
    }
  }

  // Function to go to previous section
  function goToPrevSection() {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo(0, 0);
    }
  }

  // Function to handle form submission
  async function onSubmit(data: any) {
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
      navigate(`/survey-confirmation/${actualSlug}`);
      
    } catch (error) {
      logger.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit form. Please try again.',
        variant: 'destructive'
      });
      setSubmitting(false);
    }
  }

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

  if (!formData || !Array.isArray(formSections) || formSections.length === 0) {
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
  
  if (!currentSection) {
    return (
      <AppLayout>
        <div className="container py-10">
          <Card>
            <CardHeader>
              <CardTitle>Section Not Found</CardTitle>
              <CardDescription>
                The current section could not be loaded.
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
              <div className="w-full bg-ss-track h-2 rounded-full overflow-hidden">
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
                      validation: field.validation,
                      max_select: field.max_select,
                      min: field.min,
                      max: field.max,
                      max_words: field.max_words,
                      file_types: field.file_types,
                      max_size_mb: field.max_size_mb,
                      text: field.text,
                      placeholder: field.placeholder
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
