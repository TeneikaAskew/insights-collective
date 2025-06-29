// Enhanced form builder with security validation
import { useState, useCallback } from 'react';
import { sanitizeUserInput, validateFileUpload } from '@/config/security';
import { validateFormFieldConfig, logSecurityEvent } from '@/utils/securityUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

interface EnhancedFormBuilderProps {
  initialFields?: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
}

export function EnhancedFormBuilder({ initialFields = [], onFieldsChange }: EnhancedFormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const { user } = useAuth();
  const { toast } = useToast();

  const validateAndSanitizeField = useCallback((field: FormField): FormField | null => {
    // Validate field configuration for security
    if (!validateFormFieldConfig(field)) {
      console.warn('Invalid field configuration detected:', field);
      if (user?.id) {
        logSecurityEvent(
          user.id,
          'invalid_form_field_config',
          'warning',
          'Potentially malicious form field configuration blocked',
          { fieldType: field.type, fieldId: field.id }
        );
      }
      return null;
    }

    // Sanitize field properties
    const sanitizedField: FormField = {
      id: sanitizeUserInput(field.id, 50),
      type: sanitizeUserInput(field.type, 20),
      label: sanitizeUserInput(field.label, 100),
      required: Boolean(field.required),
      options: field.options?.map(option => sanitizeUserInput(option, 100)),
      validation: field.validation ? {
        minLength: field.validation.minLength ? Math.max(0, Math.min(field.validation.minLength, 1000)) : undefined,
        maxLength: field.validation.maxLength ? Math.max(0, Math.min(field.validation.maxLength, 10000)) : undefined,
        pattern: field.validation.pattern ? sanitizeUserInput(field.validation.pattern, 200) : undefined
      } : undefined
    };

    return sanitizedField;
  }, [user?.id]);

  const addField = useCallback((fieldType: string) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: fieldType,
      label: `New ${fieldType} field`,
      required: false
    };

    const validatedField = validateAndSanitizeField(newField);
    if (!validatedField) {
      toast({
        title: 'Invalid Field',
        description: 'The field configuration is not valid.',
        variant: 'destructive'
      });
      return;
    }

    const updatedFields = [...fields, validatedField];
    setFields(updatedFields);
    onFieldsChange(updatedFields);
  }, [fields, onFieldsChange, validateAndSanitizeField, toast]);

  const updateField = useCallback((index: number, updates: Partial<FormField>) => {
    const updatedField = { ...fields[index], ...updates };
    const validatedField = validateAndSanitizeField(updatedField);
    
    if (!validatedField) {
      toast({
        title: 'Invalid Field Update',
        description: 'The field update contains invalid data.',
        variant: 'destructive'
      });
      return;
    }

    const updatedFields = fields.map((field, i) => i === index ? validatedField : field);
    setFields(updatedFields);
    onFieldsChange(updatedFields);
  }, [fields, onFieldsChange, validateAndSanitizeField, toast]);

  const removeField = useCallback((index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index);
    setFields(updatedFields);
    onFieldsChange(updatedFields);
  }, [fields, onFieldsChange]);

  return (
    <div className="space-y-4">
      {/* Form builder UI would go here */}
      <p className="text-sm text-muted-foreground">
        Enhanced form builder with security validation
      </p>
    </div>
  );
}