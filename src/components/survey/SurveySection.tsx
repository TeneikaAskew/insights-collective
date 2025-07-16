
import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import SurveyField from '@/components/survey/SurveyField';
import { SectionData } from '@/data/surveyData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

import { createLogger } from '@/utils/logger';

const logger = createLogger('generateFieldName');

interface SurveySectionProps {
  section: SectionData;
  formData: Record<string, any>;
  formId?: string;
  onSaveDraft?: (data: Record<string, any>) => void;
}

const SurveySection: React.FC<SurveySectionProps> = ({ 
  section, 
  formData, 
  formId,
  onSaveDraft 
}) => {
  const { formState: { errors }, getValues, watch } = useFormContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Watch form values to trigger auto-save
  const formValues = watch();
  
  // Function to generate a consistent fieldName for each field
  const generateFieldName = (field: any, index: number) => {
    // Use the field label as the field name for easier identification
    // This makes dependent fields easier to implement
    return field.label;
  };
  
  // Function to save draft data to localStorage and database
  const saveDraft = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    const currentValues = getValues();
    try {
      // Save to localStorage
      localStorage.setItem(`survey_draft_${user?.id || 'guest'}_${formId || 'fellowship'}`, JSON.stringify(currentValues));
      
      // Save to database if user is authenticated and formId is available
      if (user?.id && formId) {
        const { error } = await supabase
          .from('survey_drafts')
          .upsert({
            user_id: user.id,
            form_id: formId,
            form_data: currentValues,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,form_id'
          });
        
        if (error) throw error;
      }
      
      // Call the parent's onSaveDraft if provided
      if (onSaveDraft) {
        onSaveDraft(currentValues);
      }
      
      toast({
        title: 'Draft Saved',
        description: 'Your responses have been saved as a draft.',
      });
    } catch (error) {
      logger.error("Error saving draft:", error);
      toast({
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Set up auto-save when form values change
  useEffect(() => {
    const debounceSave = setTimeout(() => {
      // Only auto-save if there are actual changes
      if (Object.keys(formValues).length > 0) {
        saveDraft();
      }
    }, 3000); // 3 second debounce
    
    return () => clearTimeout(debounceSave);
  }, [JSON.stringify(formValues)]);

  // Set up auto-save
  useEffect(() => {
    // Clear any existing timer when component mounts or unmounts
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }

    // Set up auto-save every 2 minutes if user is logged in
    if (user?.id) {
      const timer = setInterval(() => {
        saveDraft();
      }, 120000); // 2 minutes
      
      setAutoSaveTimer(timer);
    }

    return () => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
    };
  }, [user?.id, formId]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{section.section}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={saveDraft}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </>
          )}
        </Button>
      </div>
      
      <div className="space-y-6">
        {section.fields.map((field, index) => {
          // Generate a unique field name using the field's label for easier identification
          const fieldName = generateFieldName(field, index);
          
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
                  // If field already has validation, merge with zip code validation if needed
                  { ...validationProps, ...(typeof field.validation === 'object' ? field.validation : {}) } : 
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
