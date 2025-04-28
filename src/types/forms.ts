
export type FormStatus = 'active' | 'inactive';

export type FormField = {
  id: string;
  label: string;
  type: 'short_text' | 'long_text' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'multi_select';
  required?: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
  placeholder?: string;
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormStructure = {
  sections: FormSection[];
};

export interface FormData {
  id: string;
  title: string;
  slug: string;
  description?: string;
  status: boolean; // true = active, false = inactive
  deadline?: string | null;
  form_link: string;
  form_structure?: FormStructure;
  created_at: string;
  updated_at: string;
}
