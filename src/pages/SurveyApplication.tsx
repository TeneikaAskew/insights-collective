
import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import AppLayout from '@/components/layout/AppLayout';
import SurveyProgress from '@/components/survey/SurveyProgress';
import SurveySection from '@/components/survey/SurveySection';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { surveyData } from '@/data/surveyData';
import { useNavigate } from 'react-router-dom';

const SurveyApplication: React.FC = () => {
  const [currentSection, setCurrentSection] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  
  const methods = useForm({
    mode: 'onChange',
    defaultValues: formData,
  });

  const { handleSubmit, formState: { isValid, errors } } = methods;

  const totalSections = surveyData.length;
  const currentProgress = ((currentSection + 1) / totalSections) * 100;

  const onSubmit = async (data: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      
      // Save current section data
      setFormData(prev => ({
        ...prev,
        ...data
      }));

      // If this is the final section, submit the whole form
      if (currentSection === totalSections - 1) {
        const finalData = {
          ...formData,
          ...data
        };
        
        // Here you would normally send the data to your backend
        console.log('Form submitted with data:', finalData);
        
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
    
    // Save to local storage for now
    localStorage.setItem('surveyDraft', JSON.stringify(updatedFormData));
    
    toast({
      title: "Progress Saved",
      description: "Your application progress has been saved as a draft.",
      variant: "default",
    });
  };

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
