
export type FormStatus = 'active' | 'inactive';

export type FormField = {
  id: string;
  label: string;
  type: 'short_text' | 'long_text' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'multi_select' | 'slider' | 'file_upload';
  required?: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  } | 'numeric_only' | 'url' | 'email';
  placeholder?: string;
  max_select?: number;
  min?: number;
  max?: number;
  max_words?: number;
  file_types?: string[];
  max_size_mb?: number;
  text?: string;
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
