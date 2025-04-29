
import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import AppLayout from '@/components/layout/AppLayout';
import SurveyProgress from '@/components/survey/SurveyProgress';
import SurveySection from '@/components/survey/SurveySection';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { surveyData } from '@/data/surveyData';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const SurveyApplication: React.FC = () => {
  const [currentSection, setCurrentSection] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const methods = useForm({
    mode: 'onChange',
    defaultValues: formData,
  });

  const { handleSubmit, formState: { isValid, errors }, reset } = methods;

  const totalSections = surveyData.length;
  const currentProgress = ((currentSection + 1) / totalSections) * 100;
  
  // Fellowship form ID
  const FORM_ID = 'ai-fellowship';

  // Load saved draft data when component mounts
  useEffect(() => {
    const loadDraft = async () => {
      setIsLoading(true);
      try {
        let draftData = null;
        
        // Try to get data from database if user is logged in
        if (user?.id) {
          const { data, error } = await supabase
            .from('survey_drafts')
            .select('form_data')
            .eq('user_id', user.id)
            .eq('form_id', FORM_ID)
            .single();
            
          if (!error && data) {
            draftData = data.form_data;
          }
        }
        
        // Fall back to local storage if no database data
        if (!draftData) {
          const savedDraft = localStorage.getItem(`survey_draft_${user?.id || 'guest'}_${FORM_ID}`);
          if (savedDraft) {
            draftData = JSON.parse(savedDraft);
          }
        }
        
        // Update form data and reset form with loaded data
        if (draftData) {
          setFormData(draftData);
          reset(draftData);
          toast({
            title: "Draft Loaded",
            description: "Your previous responses have been loaded.",
          });
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDraft();
  }, [user?.id, reset]);

  const onSubmit = async (data: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      
      // Save current section data
      const updatedFormData = {
        ...formData,
        ...data
      };
      
      setFormData(updatedFormData);
      
      // Save to localStorage
      localStorage.setItem(`survey_draft_${user?.id || 'guest'}_${FORM_ID}`, JSON.stringify(updatedFormData));

      // If this is the final section, submit the whole form
      if (currentSection === totalSections - 1) {
        const finalData = updatedFormData;
        
        // Submit to database if user is logged in
        if (user?.id) {
          const { error } = await supabase
            .from('form_submissions')
            .insert({
              form_id: FORM_ID,
              user_id: user.id,
              submission_data: finalData,
              created_at: new Date().toISOString()
            });
            
          if (error) throw error;
          
          // Clean up draft after submission
          await supabase
            .from('survey_drafts')
            .delete()
            .eq('user_id', user.id)
            .eq('form_id', FORM_ID);
        }
        
        // Remove from local storage
        localStorage.removeItem(`survey_draft_${user?.id || 'guest'}_${FORM_ID}`);
        
        // Show success message
        toast({
          title: "Application Submitted!",
          description: "Thank you for applying to the AI & Automation Skills Fellowship.",
          variant: "default",
        });
        
        // Redirect to confirmation page
        navigate('/survey-confirmation');
      } else {
        // Move to next section
        setCurrentSection(prev => prev + 1);
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Submission Error",
        description: "There was a problem submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    // Save current data before going to previous section
    const currentData = methods.getValues();
    const updatedFormData = {
      ...formData,
      ...currentData
    };
    
    setFormData(updatedFormData);
    localStorage.setItem(`survey_draft_${user?.id || 'guest'}_${FORM_ID}`, JSON.stringify(updatedFormData));
    
    // Navigate to previous section
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSaveDraft = () => {
    const currentData = methods.getValues();
    const updatedFormData = {
      ...formData,
      ...currentData
    };
    
    setFormData(updatedFormData);
    
    // Save to localStorage
    localStorage.setItem(`survey_draft_${user?.id || 'guest'}_${FORM_ID}`, JSON.stringify(updatedFormData));
    
    // Save to database if user is logged in
    if (user?.id) {
      supabase
        .from('survey_drafts')
        .upsert({
          user_id: user.id,
          form_id: FORM_ID,
          form_data: updatedFormData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,form_id'
        })
        .then(({ error }) => {
          if (error) console.error("Error saving draft to database:", error);
        });
    }
    
    toast({
      title: "Progress Saved",
      description: "Your application progress has been saved as a draft.",
      variant: "default",
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container max-w-4xl py-8 px-4 md:px-6 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
            <p>Loading your application...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8 px-4 md:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI & Automation Skills Fellowship</h1>
          <p className="text-muted-foreground">
            Complete all sections to submit your application for the fellowship program.
          </p>
        </div>

        <SurveyProgress currentStep={currentSection} totalSteps={totalSections} />

        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <SurveySection 
                section={surveyData[currentSection]} 
                formData={formData}
                formId={FORM_ID}
                onSaveDraft={(data) => {
                  setFormData(prev => ({ ...prev, ...data }));
                }}
              />
              
              <div className="flex flex-wrap justify-between mt-8 pt-6 border-t">
                <div className="flex space-x-2 mb-4 sm:mb-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentSection === 0}
                    className="flex items-center"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    className="flex items-center"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Draft
                  </Button>
                </div>
                
                <Button 
                  type="submit"
                  disabled={!isValid || isSubmitting}
                  className="flex items-center"
                >
                  {currentSection === totalSections - 1 ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Submit Application
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </FormProvider>
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <p>* Required fields</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default SurveyApplication;
