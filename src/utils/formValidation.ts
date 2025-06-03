
import { sanitizeInput, isValidEmail, isValidUrl } from './securityUtils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateFormField = (
  value: any, 
  fieldType: string, 
  required: boolean = false,
  options?: any
): ValidationResult => {
  const errors: string[] = [];
  
  // Check required fields
  if (required && (!value || (typeof value === 'string' && !value.trim()))) {
    errors.push('This field is required');
    return { isValid: false, errors };
  }
  
  // If not required and empty, it's valid
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { isValid: true, errors: [] };
  }
  
  // Type-specific validation
  switch (fieldType) {
    case 'email':
      if (!isValidEmail(value)) {
        errors.push('Please enter a valid email address');
      }
      break;
      
    case 'url':
      if (!isValidUrl(value)) {
        errors.push('Please enter a valid URL');
      }
      break;
      
    case 'text':
    case 'textarea':
      // Sanitize and validate text inputs
      const sanitized = sanitizeInput(value);
      if (sanitized !== value) {
        errors.push('Input contains invalid characters');
      }
      if (options?.minLength && sanitized.length < options.minLength) {
        errors.push(`Must be at least ${options.minLength} characters`);
      }
      if (options?.maxLength && sanitized.length > options.maxLength) {
        errors.push(`Must be no more than ${options.maxLength} characters`);
      }
      break;
      
    case 'phone':
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(value.replace(/\s/g, ''))) {
        errors.push('Please enter a valid phone number');
      }
      break;
      
    case 'number':
      if (isNaN(Number(value))) {
        errors.push('Please enter a valid number');
      }
      if (options?.min !== undefined && Number(value) < options.min) {
        errors.push(`Must be at least ${options.min}`);
      }
      if (options?.max !== undefined && Number(value) > options.max) {
        errors.push(`Must be no more than ${options.max}`);
      }
      break;
      
    case 'select':
      if (options?.allowedValues && !options.allowedValues.includes(value)) {
        errors.push('Please select a valid option');
      }
      break;
  }
  
  return { isValid: errors.length === 0, errors };
};

export const validateFormData = (formData: any, schema: any): ValidationResult => {
  const allErrors: string[] = [];
  
  // Validate each field according to schema
  Object.keys(schema).forEach(fieldName => {
    const fieldConfig = schema[fieldName];
    const fieldValue = formData[fieldName];
    
    const result = validateFormField(
      fieldValue,
      fieldConfig.type,
      fieldConfig.required,
      fieldConfig.options
    );
    
    if (!result.isValid) {
      allErrors.push(...result.errors.map(error => `${fieldName}: ${error}`));
    }
  });
  
  return { isValid: allErrors.length === 0, errors: allErrors };
};
