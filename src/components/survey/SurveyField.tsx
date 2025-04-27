
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CalendarIcon, Info, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FieldData } from '@/data/surveyData';

interface SurveyFieldProps {
  field: FieldData;
  fieldName: string;
  defaultValue?: any;
}

const SurveyField: React.FC<SurveyFieldProps> = ({ field, fieldName, defaultValue }) => {
  const { register, control, setValue, getValues, formState: { errors }, watch } = useFormContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  // For limiting multi-select options
  const handleMultiSelect = (option: string) => {
    const currentSelections = [...selectedOptions];
    const maxSelect = field.max_select || Infinity;
    
    if (currentSelections.includes(option)) {
      // Remove the option if already selected
      setSelectedOptions(currentSelections.filter(item => item !== option));
      setValue(fieldName, currentSelections.filter(item => item !== option));
    } else {
      // Add the option if not at max limit
      if (currentSelections.length < maxSelect) {
        const newSelections = [...currentSelections, option];
        setSelectedOptions(newSelections);
        setValue(fieldName, newSelections);
      }
    }
  };

  // For file upload handling
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Check file type
      if (field.file_types && !field.file_types.includes(file.name.split('.').pop()?.toLowerCase() || '')) {
        alert(`Only ${field.file_types.join(', ')} files are allowed.`);
        event.target.value = '';
        return;
      }
      
      // Check file size
      if (field.max_size_mb && file.size > field.max_size_mb * 1024 * 1024) {
        alert(`File size must be less than ${field.max_size_mb}MB.`);
        event.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      setValue(fieldName, file);
    }
  };

  const renderField = () => {
    switch (field.type) {
      case 'short_text':
        return (
          <FormField
            control={control}
            name={fieldName}
            defaultValue={defaultValue || ''}
            rules={{ 
              required: field.required ? 'This field is required' : false,
              validate: (value) => {
                if (field.validation === 'numeric_only' && !/^\d*\.?\d*$/.test(value)) {
                  return 'Please enter a valid number';
                }
                return true;
              }
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input {...formField} placeholder={`Enter ${field.label.toLowerCase()}`} />
                    {field.validation && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-auto"
                            >
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {field.validation === 'numeric_only' ? 'Please enter numbers only' : ''}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      case 'long_text':
        return (
          <FormField
            control={control}
            name={fieldName}
            defaultValue={defaultValue || ''}
            rules={{ 
              required: field.required ? 'This field is required' : false,
              validate: (value) => {
                if (field.max_words && value.trim().split(/\s+/).length > field.max_words) {
                  return `Please limit your response to ${field.max_words} words`;
                }
                return true;
              }
            }}
            render={({ field: formField }) => {
              const wordCount = watch(fieldName)?.trim().split(/\s+/).filter(Boolean).length || 0;
              return (
                <FormItem>
                  <FormLabel>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Textarea 
                        {...formField} 
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="min-h-32"
                      />
                      {field.max_words && (
                        <div className="text-xs text-muted-foreground text-right">
                          {wordCount}/{field.max_words} words
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        );
        
      case 'dropdown':
        return (
          <FormField
            control={control}
            name={fieldName}
            defaultValue={defaultValue || ''}
            rules={{ required: field.required ? 'This field is required' : false }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
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
                  <SelectContent className="max-h-80">
                    {field.options?.map((option) => (
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
            defaultValue={defaultValue || ''}
            rules={{ required: field.required ? 'This field is required' : false }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={formField.onChange}
                    defaultValue={formField.value}
                    className="flex flex-col space-y-2 mt-2"
                  >
                    {field.options?.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${fieldName}-${option}`} />
                        <label htmlFor={`${fieldName}-${option}`} className="text-sm font-normal leading-none">
                          {option}
                        </label>
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
            defaultValue={defaultValue || false}
            rules={{ required: field.required ? 'This field is required' : false }}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </FormLabel>
                  {field.text && (
                    <FormDescription>
                      {field.text}
                    </FormDescription>
                  )}
                </div>
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
            defaultValue={defaultValue || []}
            rules={{ 
              required: field.required ? 'Please select at least one option' : false,
              validate: (value) => {
                if (field.required && (!value || value.length === 0)) {
                  return 'Please select at least one option';
                }
                return true;
              }
            }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                {field.max_select && (
                  <FormDescription>
                    Please select up to {field.max_select} options
                  </FormDescription>
                )}
                <FormControl>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedOptions.map(option => (
                      <Badge key={option} variant="secondary" className="flex items-center gap-1">
                        {option}
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => handleMultiSelect(option)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </FormControl>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {field.options?.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={selectedOptions.includes(option) ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => handleMultiSelect(option)}
                      disabled={selectedOptions.length >= (field.max_select || Infinity) && !selectedOptions.includes(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
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
            defaultValue={defaultValue || field.min || 1}
            rules={{ required: field.required ? 'This field is required' : false }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <Slider
                      min={field.min || 1}
                      max={field.max || 5}
                      step={1}
                      value={[formField.value]}
                      onValueChange={(values) => formField.onChange(values[0])}
                      className="py-4"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Beginner ({field.min || 1})</span>
                      <span>Expert ({field.max || 5})</span>
                    </div>
                    <div className="text-center font-medium">
                      Current rating: {formField.value}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      case 'date_picker':
        return (
          <FormField
            control={control}
            name={fieldName}
            defaultValue={defaultValue || undefined}
            rules={{ required: field.required ? 'This field is required' : false }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formField.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formField.value ? (
                          format(new Date(formField.value), "PPP")
                        ) : (
                          <span>Select a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formField.value ? new Date(formField.value) : undefined}
                        onSelect={formField.onChange}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
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
            defaultValue={defaultValue || null}
            rules={{ required: field.required ? 'Please upload a file' : false }}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        id={fieldName}
                        accept={field.file_types ? `.${field.file_types.join(',.').toLowerCase()}` : undefined}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => document.getElementById(fieldName)?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {selectedFile ? 'Change File' : 'Select File'}
                      </Button>
                    </div>
                    
                    {selectedFile && (
                      <div className="bg-muted p-2 rounded-md flex items-center justify-between">
                        <div className="text-sm truncate">{selectedFile.name}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(null);
                            setValue(fieldName, null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <FormDescription>
                      {field.file_types && `Accepted formats: ${field.file_types.join(', ').toUpperCase()}`}
                      {field.max_size_mb && ` (Max: ${field.max_size_mb}MB)`}
                    </FormDescription>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      default:
        return <div>Unsupported field type: {field.type}</div>;
    }
  };

  return (
    <div className="border-b pb-6 last:border-b-0 last:pb-0">
      {renderField()}
    </div>
  );
};

export default SurveyField;
