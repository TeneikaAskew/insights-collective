
import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUp, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
  const { control, setValue } = useFormContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [existingResume, setExistingResume] = useState<{ id: string; file_path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Check if the user has a resume already (for resume upload fields)
  useEffect(() => {
    const checkExistingResume = async () => {
      if (field.type === 'file_upload' && 
          field.label.toLowerCase().includes('resume') && 
          user?.id) {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('id, file_path')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data && !error) {
            setExistingResume(data);
          }
        } catch (err) {
          console.error("Error checking for existing resume:", err);
        }
      }
    };
    
    checkExistingResume();
  }, [field.type, field.label, user?.id]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Set form value to the file name for now (will be replaced with path after upload)
      setValue(fieldName, file.name);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !user?.id) return;
    
    try {
      setIsUploading(true);
      
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `resumes/${fileName}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, selectedFile);
        
      if (uploadError) {
        throw uploadError;
      }
      
      // Save to resumes table
      const { error: dbError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_path: filePath,
          updated_at: new Date().toISOString()
        });
        
      if (dbError) {
        throw dbError;
      }
      
      // Set the form value to the file path
      setValue(fieldName, filePath);
      
      toast({
        title: 'Resume Uploaded',
        description: 'Your resume was uploaded successfully.',
      });
      
    } catch (error) {
      console.error("Error uploading resume:", error);
      toast({
        title: 'Upload Failed',
        description: 'There was an error uploading your resume. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const useExistingResume = () => {
    if (existingResume) {
      setValue(fieldName, existingResume.file_path);
      toast({
        title: 'Using Existing Resume',
        description: 'Your previously uploaded resume will be used.',
      });
    }
  };
  
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
                      // Ensure option is not empty string
                      <SelectItem 
                        key={option || "empty-option-placeholder"} 
                        value={option || "empty-option-placeholder"} // Use placeholder for empty options
                      >
                        {option || "—"}
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
                </FormLabel>
                
                {/* If this is a resume field and user has an existing resume, show option to use it */}
                {field.label.toLowerCase().includes('resume') && existingResume && (
                  <Alert className="mb-4">
                    <AlertDescription className="flex flex-col gap-2">
                      <p>You already have a resume on file.</p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={useExistingResume}
                        className="w-full sm:w-auto"
                      >
                        Use Existing Resume
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <FormControl>
                      <Input 
                        type="file" 
                        accept={field.file_types?.join(', ') || '.pdf,.docx,.doc'} 
                        onChange={handleFileChange}
                        className="flex-1"
                      />
                    </FormControl>
                    
                    <Button 
                      type="button" 
                      onClick={handleFileUpload}
                      disabled={!selectedFile || isUploading}
                      className="flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {formField.value && (
                    <p className="text-sm text-muted-foreground">
                      File: {formField.value.split('/').pop()}
                    </p>
                  )}
                  
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        );
      
      // Handle additional field types - for now they'll render as text inputs
      case 'multi_select':
      case 'slider':
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
