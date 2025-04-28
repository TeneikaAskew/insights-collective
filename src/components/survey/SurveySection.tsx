import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import SurveyField from '@/components/survey/SurveyField';
import { SectionData } from '@/data/surveyData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SurveySectionProps {
  section: SectionData;
  formData: Record<string, any>;
}

const SurveySection: React.FC<SurveySectionProps> = ({ section, formData }) => {
  const { formState: { errors }, getValues } = useFormContext();
  const { user } = useAuth();
  const { toast } = useToast();

  // Load saved draft data from localStorage when component mounts
  useEffect(() => {
    const savedDraft = localStorage.getItem(`survey_draft_${user?.id}`);
    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      // We don't need to do anything here as the parent component handles loading the draft
    }
  }, [user?.id]);

  // Function to save draft data to localStorage and database
  const saveDraft = async () => {
    const currentValues = getValues();
    try {
      // Save to localStorage
      localStorage.setItem(`survey_draft_${user?.id}`, JSON.stringify(currentValues));
      
      // Save to database if user is authenticated
      if (user?.id) {
        const { error } = await supabase
          .from('survey_drafts')
          .upsert({
            user_id: user.id,
            form_data: currentValues,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
        
        if (error) throw error;
      }
      
      toast({
        title: 'Draft Saved',
        description: 'Your responses have been saved as a draft.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add a global event listener for the "Save Draft" button click
  useEffect(() => {
    const handleSaveDraftClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.textContent?.includes('Save Draft') || 
          target.parentElement?.textContent?.includes('Save Draft')) {
        saveDraft();
      }
    };

    document.addEventListener('click', handleSaveDraftClick);
    
    return () => {
      document.removeEventListener('click', handleSaveDraftClick);
    };
  }, [user?.id]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">{section.section}</h2>
      
      <div className="space-y-6">
        {section.fields.map((field, index) => {
          // Generate a unique field name
          const fieldName = `${section.section.toLowerCase().replace(/\s+/g, '_')}_${index}`;
          
          // Add validation for zip code fields
          let validationProps = {};
          if (field.label?.toLowerCase().includes('zip code') || field.label?.toLowerCase().includes('postal code')) {
            validationProps = {
              maxLength: {
                value: 5,
                message: "Zip code cannot exceed 5 digits"
              },
              pattern: {
                value: /^\d{5}$/,
                message: "Please enter a valid 5-digit zip code"
              }
            };
          }
          
          return (
            <SurveyField
              key={`${section.section}-${index}`}
              field={{
                ...field,
                validation: field.validation ? 
                  // If field already has validation, merge it with zip code validation if needed
                  { ...field.validation, ...validationProps } : 
                  // Otherwise just use the zip code validation if needed
                  Object.keys(validationProps).length > 0 ? validationProps : undefined
              }}
              fieldName={fieldName}
              defaultValue={formData[fieldName]}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SurveySection;
