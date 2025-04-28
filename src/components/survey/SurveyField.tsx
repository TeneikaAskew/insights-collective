
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface FieldData {
  label: string;
  type: 'text' | 'textarea' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 
        'short_text' | 'long_text' | 'multi_select' | 'slider' | 'date_picker' | 'file_upload';
  required?: boolean;
  options?: string[];
  validation?: {
    minLength?: {
      value: number;
      message: string;
    };
    maxLength?: {
      value: number;
      message: string;
    };
    pattern?: {
      value: RegExp;
      message: string;
    };
  };
  max_select?: number;
  min?: number;
  max?: number;
  max_words?: number;
  file_types?: string[];
  max_size_mb?: number;
  text?: string;
}

interface SurveyFieldProps {
  field: FieldData;
  fieldName: string;
  defaultValue?: any;
}

const SurveyField: React.FC<SurveyFieldProps> = ({ field, fieldName, defaultValue }) => {
  const { control } = useFormContext();
  
  const renderField = () => {
    // Map survey data types to SurveyField types
    const fieldType = (() => {
      switch (field.type) {
        case 'short_text': return 'text';
        case 'long_text': return 'textarea';
        case 'date_picker': return 'date';
        default: return field.type;
      }
    })();

    switch (fieldType) {
      case 'text':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false,
              ...field.validation
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input placeholder={`Enter ${field.label.toLowerCase()}`} {...formField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'textarea':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false,
              ...field.validation
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea placeholder={`Enter ${field.label.toLowerCase()}`} {...formField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'dropdown':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </FormLabel>
                <Select 
                  onValueChange={formField.onChange} 
                  defaultValue={formField.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'radio':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false
            }}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={formField.onChange}
                    defaultValue={formField.value}
                    className="flex flex-col space-y-1"
                  >
                    {field.options?.map(option => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${fieldName}-${option}`} />
                        <Label htmlFor={`${fieldName}-${option}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'checkbox':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false
            }}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </FormLabel>
                <div className="space-y-2">
                  {field.options ? (
                    // For multiple checkboxes (selecting from options)
                    field.options.map(option => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`${fieldName}-${option}`} 
                          checked={formField.value?.includes(option)}
                          onCheckedChange={(checked) => {
                            const value = formField.value || [];
                            if (checked) {
                              formField.onChange([...value, option]);
                            } else {
                              formField.onChange(value.filter((v: string) => v !== option));
                            }
                          }}
                        />
                        <Label htmlFor={`${fieldName}-${option}`}>{option}</Label>
                      </div>
                    ))
                  ) : (
                    // For a single checkbox agreement
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id={fieldName} 
                        checked={formField.value}
                        onCheckedChange={formField.onChange}
                      />
                      <Label className="leading-normal" htmlFor={fieldName}>
                        {field.text || field.label}
                      </Label>
                    </div>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'date':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input type="date" {...formField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      // Handle additional field types - for now they'll render as text inputs
      case 'multi_select':
      case 'slider':
      case 'file_upload':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={{
              required: field.required ? "This field is required" : false
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                  <span className="text-xs text-muted-foreground">(This field type is not fully implemented yet)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder={`${field.type} field (not fully implemented)`} {...formField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      default:
        return null;
    }
  };

  return renderField();
};

export default SurveyField;
