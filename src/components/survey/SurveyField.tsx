
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
import { Upload, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

import { createLogger } from '@/utils/logger';

const logger = createLogger('shouldShowField');

interface FieldData {
  label: string;
  type: 'text' | 'textarea' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 
        'short_text' | 'long_text' | 'multi_select' | 'slider' | 'date_picker' | 'file_upload' | 'url';
  required?: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
    type?: 'numeric_only' | 'url' | 'email' | 'gpa' | 'linkedin_url';
  };
  max_select?: number;
  min?: number;
  max?: number;
  step?: number;
  max_words?: number;
  file_types?: string[];
  max_size_mb?: number;
  text?: string;
  subtitle?: string;
  depends_on?: {
    field: string;
    value: string | string[] | boolean;
  };
}

interface SurveyFieldProps {
  field: FieldData;
  fieldName: string;
  defaultValue?: any;
}

const SurveyField: React.FC<SurveyFieldProps> = ({ field, fieldName, defaultValue }) => {
  const { control, setValue, watch } = useFormContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [existingResume, setExistingResume] = useState<{ id: string; file_path: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // For handling dependencies between fields
  const formValues = watch();
  
  // Check if this field should be shown based on dependencies
  const shouldShowField = () => {
    if (!field.depends_on) return true;
    
    const dependencyValue = formValues[field.depends_on.field];
    
    if (Array.isArray(field.depends_on.value)) {
      return field.depends_on.value.includes(dependencyValue);
    }
    
    return dependencyValue === field.depends_on.value;
  };
  
  // For auto-filling income range based on the amount entered
  useEffect(() => {
    if (field.label === "Please select the income range that matches the amount you entered") {
      const incomeAmount = formValues["What is your annual household income amount?"];
      if (!incomeAmount) return;
      
      const amount = Number(incomeAmount);
      let selectedRange = "";
      
      if (amount < 25000) {
        selectedRange = "<$25,000";
      } else if (amount <= 50000) {
        selectedRange = "$25,001–$50,000";
      } else if (amount <= 75000) {
        selectedRange = "$50,001–$75,000";
      } else if (amount <= 100000) {
        selectedRange = "$75,001–$100,000";
      } else {
        selectedRange = "$100,001+";
      }
      
      setValue(fieldName, selectedRange);
    }
  }, [formValues["What is your annual household income amount?"]]);
  
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
          logger.error("Error checking for existing resume:", err);
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
      // Every policy on the resumes bucket scopes to the first path segment
      // being the owner's uid. This used to upload to `resumes/<uid>-<rand>`,
      // whose first segment is the literal string "resumes" — so it satisfied
      // no scoped policy and only succeeded because a second, unscoped INSERT
      // policy allowed any authenticated write anywhere in the bucket. Worse,
      // the file could never be read back: the SELECT policy requires the uid
      // folder. Match the layout useResumeStorage already uses.
      const filePath = `${user.id}/resume_${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
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
      logger.error("Error uploading resume:", error);
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
  
  // Build validation rules based on field configuration
  const getValidationRules = () => {
    const rules: Record<string, any> = {
      required: field.required ? "This field is required" : false
    };

    // Add validation based on the field settings
    if (field.validation) {
      if (field.validation.minLength) {
        rules.minLength = {
          value: field.validation.minLength,
          message: field.validation.message || `Minimum length is ${field.validation.minLength} characters`
        };
      }
      
      if (field.validation.maxLength) {
        rules.maxLength = {
          value: field.validation.maxLength,
          message: field.validation.message || `Maximum length is ${field.validation.maxLength} characters`
        };
      }
      
      if (field.validation.pattern) {
        rules.pattern = {
          value: new RegExp(field.validation.pattern),
          message: field.validation.message || "Input doesn't match the required pattern"
        };
      }
      
      // Special validation types
      if (field.validation.type) {
        switch (field.validation.type) {
          case 'numeric_only':
            rules.pattern = {
              value: /^[0-9]*$/,
              message: field.validation.message || "Please enter numbers only"
            };
            break;
          case 'email':
            rules.pattern = {
              value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
              message: field.validation.message || "Please enter a valid email address"
            };
            break;
          case 'url':
            // Validated with the URL parser rather than a regex. The previous
            // pattern was a ReDoS (CodeQL js/redos: the (X*)* tail took 14s on
            // 30 chars) and a URL regex also draws js/regex/missing-regexp-anchor;
            // parsing has neither problem and is a stricter, clearer check. A
            // scheme-less entry ("example.com") is accepted by trying https://
            // in front, matching the old pattern's optional-scheme behavior.
            rules.validate = (value: any) => {
              if (!value) return true; // presence is enforced by `required`
              const raw = String(value).trim();
              for (const candidate of [raw, `https://${raw}`]) {
                try {
                  const u = new URL(candidate);
                  if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.')) {
                    return true;
                  }
                } catch {
                  // try the next candidate
                }
              }
              return field.validation.message || 'Please enter a valid URL';
            };
            break;
          case 'gpa':
            rules.pattern = {
              value: /^[0-4](\.[0-9]{0,2})?$/,
              message: field.validation.message || "Please enter a valid GPA between 0.00 and 4.00"
            };
            break;
          case 'linkedin_url':
            // Parsed, not pattern-matched. The old /.*linkedin\.com.*/ matched
            // anywhere (CodeQL js/regex/missing-regexp-anchor), so
            // "evil.com/linkedin.com" and "linkedin.com.evil.net" both passed.
            // Require linkedin.com (or a subdomain) as the actual host.
            rules.validate = (value: any) => {
              if (!value) return true; // presence is enforced by `required`
              const raw = String(value).trim();
              for (const candidate of [raw, `https://${raw}`]) {
                try {
                  const u = new URL(candidate);
                  const host = u.hostname.toLowerCase();
                  if (
                    (u.protocol === 'http:' || u.protocol === 'https:') &&
                    (host === 'linkedin.com' || host.endsWith('.linkedin.com'))
                  ) {
                    return true;
                  }
                } catch {
                  // try the next candidate
                }
              }
              return field.validation.message || 'Please enter a valid LinkedIn URL';
            };
            break;
        }
      }
    }

    return rules;
  };
  
  // If this field should be hidden due to dependencies, don't render it
  if (!shouldShowField()) {
    return null;
  }
  
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
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
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
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
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
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
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
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
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
      
      case 'checkbox': {
        // For single agreement checkboxes, use validate instead of required
        // so that `false` is rejected (required only checks for undefined/empty)
        const isAgreementCheckbox = !field.options;
        const checkboxRules = isAgreementCheckbox && field.required
          ? { validate: (value: any) => value === true || "This field is required" }
          : getValidationRules();

        return (
          <FormField
            control={control}
            name={fieldName}
            defaultValue={isAgreementCheckbox ? false : []}
            rules={checkboxRules}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                {field.options && (
                  <FormLabel className="flex items-start gap-2">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </FormLabel>
                )}
                <FormControl>
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
                      <div className="flex items-start space-x-3">
                        <Checkbox 
                          id={fieldName} 
                          checked={!!formField.value}
                          onCheckedChange={formField.onChange}
                          className="mt-1"
                        />
                        <Label className="leading-normal cursor-pointer" htmlFor={fieldName}>
                          {field.text || field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      }
      
      case 'date':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Input type="date" {...formField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'multi_select':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {field.options?.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${fieldName}-${option}`}
                          checked={(formField.value || []).includes(option)}
                          onCheckedChange={(checked) => {
                            const currentValues = formField.value || [];
                            const newValues = checked
                              ? [...currentValues, option]
                              : currentValues.filter((value: string) => value !== option);
                            formField.onChange(newValues);
                          }}
                        />
                        <Label htmlFor={`${fieldName}-${option}`}>{option}</Label>
                      </div>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      case 'slider':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem className="space-y-4">
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </FormLabel>
                {field.subtitle && (
                  <p className="text-sm text-muted-foreground -mt-2">{field.subtitle}</p>
                )}
                <div className="space-y-2">
                  <div className="pt-4">
                    <Slider
                      defaultValue={[formField.value || field.min || 0]}
                      min={field.min || 0}
                      max={field.max || 100}
                      step={field.step || 1}
                      onValueChange={([value]) => formField.onChange(value)}
                      className="w-full"
                      aria-label={field.label}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{field.min || 0}</span>
                    <span>Selected: {formField.value || field.min || 0}</span>
                    <span>{field.max || 100}</span>
                  </div>
                </div>
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
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
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
                      File: {typeof formField.value === 'string' ? formField.value.split('/').pop() : 'Unknown file'}
                    </p>
                  )}
                  
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        );
      
      case 'url':
        return (
          <FormField
            control={control}
            name={fieldName}
            rules={getValidationRules()}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="flex items-start gap-2">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <LinkIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder={`Enter URL`} 
                      {...formField} 
                      className="pl-8"
                    />
                  </div>
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
