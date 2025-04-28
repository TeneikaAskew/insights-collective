
import { FormField, FormSection, FormStructure } from '@/types/forms';

export interface FormData {
  id: string;
  title: string;
  description: string;
  status: boolean;
}

export interface FormBuilderProps {
  initialFormData?: {
    id: string;
    title: string;
    description: string;
    status: boolean;
    slug?: string;
    form_structure?: FormStructure;
  } | null;
}

export interface SectionEditorProps {
  section: FormSection;
  sectionIndex: number;
  onUpdateSection: (sectionId: string, data: Partial<FormSection>) => void;
  onRemoveSection: (sectionId: string) => void;
  onAddField: (sectionId: string) => void;
  onUpdateField: (sectionId: string, fieldId: string, data: Partial<FormField>) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
}

export interface FieldEditorProps {
  field: FormField;
  sectionId: string;
  fieldIndex: number;
  onUpdateField: (sectionId: string, fieldId: string, data: Partial<FormField>) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
}

export interface FormListProps {
  searchTerm?: string;
  legacy?: boolean;
}
