
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Trash2, Upload, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CourseDetailsFormProps {
  course: any;
  onCourseUpdate: (updatedCourse: any) => void;
}

const CourseDetailsForm = ({ course, onCourseUpdate }: CourseDetailsFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { uploadFile, uploading, progress } = useStorageUpload();
  
  const [formState, setFormState] = useState({
    ...course,
    tags: course.tags || []
  });
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiGenerating, setAiGenerating] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is updated
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const handleSwitchChange = (checked: boolean, name: string) => {
    setFormState(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    if (!formState.tags.includes(newTag.trim())) {
      setFormState(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
    }
    
    setNewTag('');
  };
  
  const handleRemoveTag = (tag: string) => {
    setFormState(prev => ({
      ...prev,
      tags: prev.tags.filter((t: string) => t !== tag)
    }));
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image_url' | 'thumbnail') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await uploadFile(file, 'course-images', `courses/${formState.id}/${type}`);
    if (result) {
      setFormState(prev => ({
        ...prev,
        [type]: result.publicUrl
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formState.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formState.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formState.category.trim()) {
      newErrors.category = 'Category is required';
    }
    
    if (!formState.level.trim()) {
      newErrors.level = 'Level is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSaving(true);
    
    try {
      const courseData = {
        ...formState,
        instructor_id: formState.instructor_id || user?.id
      };
      
      const { data, error } = await supabase
        .from('courses')
        .update(courseData)
        .eq('id', course.id)
        .select()
        .single();
      
      if (error) throw error;
      
      onCourseUpdate(data);
      
      toast({
        title: 'Success',
        description: 'Course updated successfully',
      });
    } catch (error: any) {
      console.error('Error saving course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save course',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  const generateWithAI = async (field: 'title' | 'description', prompt?: string) => {
    setAiGenerating(true);
    
    try {
      const fieldPrompt = field === 'title' 
        ? `Generate a compelling course title for a ${formState.category} course about ${formState.description || 'data science'}`
        : `Write a detailed course description for a ${formState.level} level course on ${formState.title || formState.category || 'data science'}. The description should be engaging, informative, and concise.`;
      
      const response = await fetch('/api/generate-course-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt || fieldPrompt,
          field,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate content');
      }
      
      const { content } = await response.json();
      
      setFormState(prev => ({
        ...prev,
        [field]: content
      }));
      
      toast({
        title: 'AI Generation Complete',
        description: `Your ${field} has been generated successfully.`,
      });
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate content',
        variant: 'destructive',
      });
    } finally {
      setAiGenerating(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Please fix the following errors:
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Provide the basic details about your course.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="title" className={errors.title ? 'text-destructive' : ''}>
                  Course Title
                </Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-2 text-primary"
                  onClick={() => generateWithAI('title')}
                  disabled={aiGenerating}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {aiGenerating ? 'Generating...' : 'Suggest with AI'}
                </Button>
              </div>
              <Input
                id="title"
                name="title"
                value={formState.title}
                onChange={handleChange}
                placeholder="e.g., Introduction to Data Science"
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category" className={errors.category ? 'text-destructive' : ''}>
                Category
              </Label>
              <Input
                id="category"
                name="category"
                value={formState.category}
                onChange={handleChange}
                placeholder="e.g., Data Engineering"
                className={errors.category ? 'border-destructive' : ''}
              />
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="level" className={errors.level ? 'text-destructive' : ''}>
                Level
              </Label>
              <Select 
                value={formState.level} 
                onValueChange={(value) => {
                  setFormState(prev => ({ ...prev, level: value }));
                  if (errors.level) {
                    setErrors(prev => ({ ...prev, level: '' }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              {errors.level && (
                <p className="text-sm text-destructive">{errors.level}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                name="duration"
                value={formState.duration || ''}
                onChange={handleChange}
                placeholder="e.g., 8 weeks"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between">
                <Label 
                  htmlFor="description" 
                  className={errors.description ? 'text-destructive' : ''}
                >
                  Description
                </Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-2 text-primary"
                  onClick={() => generateWithAI('description')}
                  disabled={aiGenerating}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {aiGenerating ? 'Generating...' : 'Suggest with AI'}
                </Button>
              </div>
              <Textarea
                id="description"
                name="description"
                value={formState.description}
                onChange={handleChange}
                placeholder="Provide a detailed description of your course..."
                className={`min-h-[120px] ${errors.description ? 'border-destructive' : ''}`}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Media & Appearance</CardTitle>
          <CardDescription>
            Add visual elements to your course.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Label htmlFor="thumbnail">Thumbnail Image</Label>
              {formState.thumbnail && (
                <div className="relative w-full aspect-video rounded-md overflow-hidden">
                  <img 
                    src={formState.thumbnail} 
                    alt="Course thumbnail" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormState(prev => ({ ...prev, thumbnail: '' }))}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'thumbnail')}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('thumbnail')?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Thumbnail'}
                </Button>
                {uploading && <Progress value={progress} className="w-[100px]" />}
              </div>
            </div>
            
            <div className="space-y-4">
              <Label htmlFor="image_url">Cover Image</Label>
              {formState.image_url && (
                <div className="relative w-full aspect-video rounded-md overflow-hidden">
                  <img 
                    src={formState.image_url} 
                    alt="Course cover" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormState(prev => ({ ...prev, image_url: '' }))}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  id="image_url"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'image_url')}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image_url')?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Cover Image'}
                </Button>
                {uploading && <Progress value={progress} className="w-[100px]" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Tags & Settings</CardTitle>
          <CardDescription>
            Add tags and configure course settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formState.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="group relative">
                  {tag}
                  <button
                    type="button"
                    className="ml-2 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex space-x-2">
              <Input
                id="newTag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            <Label htmlFor="enrollment_status">Enrollment Status</Label>
            <Select 
              value={formState.enrollment_status || 'open'} 
              onValueChange={(value) => {
                setFormState(prev => ({ ...prev, enrollment_status: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select enrollment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="invite_only">Invite Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="published"
              checked={formState.published}
              onCheckedChange={(checked) => handleSwitchChange(checked, 'published')}
            />
            <Label htmlFor="published">
              {formState.published ? 'Published' : 'Draft'}
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saving || aiGenerating}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Course'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default CourseDetailsForm;
