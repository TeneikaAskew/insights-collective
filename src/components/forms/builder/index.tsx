
import FormBuilder from './FormBuilder';
import { surveyData } from '@/data/surveyData';
import { FormData } from '@/types/forms';
import { v4 as uuidv4 } from 'uuid';

// Create a default form structure from the fellowship survey data
export const createFellowshipForm = (): FormData => {
  // Generate a proper UUID for the form id
  const formId = uuidv4();
  
  return {
    id: formId,
    title: 'AI & Automation Skills Fellowship',
    slug: 'ai-fellowship', // Keep the slug as 'ai-fellowship'
    description: 'Complete all sections to submit your application for the fellowship program.',
    status: true,
    form_link: '/survey',
    form_structure: {
      sections: surveyData.map(section => ({
        id: section.section.toLowerCase().replace(/\s+/g, '-'),
        title: section.section,
        description: '',
        fields: section.fields.map((field, idx) => {
          // Helper function to ensure field.type is one of the allowed types
          const mapFieldType = (type: string): 'short_text' | 'long_text' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'multi_select' | 'slider' | 'file_upload' => {
            switch (type) {
              case 'short_text': return 'short_text';
              case 'long_text': return 'long_text'; 
              case 'dropdown': return 'dropdown';
              case 'radio': return 'radio';
              case 'checkbox': return 'checkbox';
              case 'multi_select': return 'multi_select';
              case 'slider': return 'slider';
              case 'date_picker': return 'date';
              case 'file_upload': return 'file_upload';
              default: return 'short_text'; // Default fallback
            }
          };

          // Process validation to ensure it's an object
          const getValidationObject = (validation: any) => {
            if (!validation) return undefined;
            
            if (typeof validation === 'string') {
              return { type: validation as 'numeric_only' | 'url' | 'email' };
            } else if (typeof validation === 'object') {
              return validation;
            }
            return undefined;
          };

          return {
            id: `${section.section.toLowerCase().replace(/\s+/g, '_')}_${idx}`,
            label: field.label,
            type: mapFieldType(field.type),
            required: field.required || false,
            options: field.options || [],
            validation: getValidationObject(field.validation),
            placeholder: field.placeholder !== undefined ? field.placeholder : '',
            max_select: field.max_select,
            min: field.min,
            max: field.max,
            max_words: field.max_words,
            file_types: field.file_types,
            max_size_mb: field.max_size_mb,
            text: field.text
          };
        })
      }))
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

export const fellowshipForm = createFellowshipForm();

export default FormBuilder;
export * from './types';
