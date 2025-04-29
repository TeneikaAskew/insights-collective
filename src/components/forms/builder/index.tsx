
import FormBuilder from './FormBuilder';
import { surveyData } from '@/data/surveyData';

// Create a default form structure from the fellowship survey data
export const fellowshipForm = {
  id: 'ai-fellowship',
  title: 'AI & Automation Skills Fellowship',
  slug: 'ai-fellowship',
  description: 'Complete all sections to submit your application for the fellowship program.',
  status: true,
  form_link: '/survey',
  form_structure: {
    sections: surveyData.map(section => ({
      id: section.section.toLowerCase().replace(/\s+/g, '-'),
      title: section.section,
      description: '',
      fields: section.fields.map((field, idx) => ({
        id: `${section.section.toLowerCase().replace(/\s+/g, '_')}_${idx}`,
        label: field.label,
        type: field.type === 'short_text' ? 'short_text' : 
              field.type === 'long_text' ? 'long_text' : 
              field.type === 'dropdown' ? 'dropdown' : 
              field.type === 'radio' ? 'radio' : 
              field.type === 'checkbox' ? 'checkbox' : 
              field.type === 'multi_select' ? 'multi_select' : 'short_text',
        required: field.required || false,
        options: field.options || [],
        validation: field.validation || undefined,
        placeholder: field.placeholder !== undefined ? field.placeholder : ''
      }))
    }))
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export default FormBuilder;
export * from './types';
