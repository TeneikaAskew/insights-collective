
import React, { useState } from 'react';
import { Course } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Plus, Trash2, Upload, Save } from 'lucide-react'; // Added Save import
import { Progress } from '@/components/ui/progress';
import AIContentGenerator from '@/components/ai/AIContentGenerator';
import { VALID_CATEGORIES } from '@/constants/courseCategories';

interface CourseDetailsFormProps {
  course: Partial<Course>;
  onSave: (course: Partial<Course>) => Promise<void>;
  loading?: boolean;
}

export const CourseDetailsForm = ({ course, onSave, loading }: CourseDetailsFormProps) => {
  const [formData, setFormData] = useState(course);
  const [newTag, setNewTag] = useState('');
  const { uploadFile, uploading, progress } = useStorageUpload();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    // Convert duration to number if it's the duration field, but keep it as string for database
    if (name === 'duration') {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    setFormData(prev => ({
      ...prev,
      tags: [...(prev.tags || []), newTag.trim()]
    }));
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(t => t !== tag)
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'thumbnail' | 'imageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadFile(file, 'course-media');
    if (result?.publicUrl) {
      setFormData(prev => ({ ...prev, [type]: result.publicUrl }));
    }
  };

  const handleAIContentGenerated = (content: string) => {
    setFormData(prev => ({
      ...prev,
      description: content
    }));
  };

  return (
    <div className="space-y-6">
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
              <Label htmlFor="title">Course Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title || ''}
                onChange={handleChange}
                placeholder="e.g., Introduction to Data Science"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select 
                value={formData.category || ''} 
                onValueChange={(value) => handleSelectChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select 
                value={formData.level || ''} 
                onValueChange={(value) => handleSelectChange('level', value)}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (weeks)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min="1"
                max="52"
                value={formData.duration || ''}
                onChange={handleChange}
                placeholder="e.g., 8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="description">Description</Label>
              <AIContentGenerator 
                onContentGenerated={handleAIContentGenerated}
                contextType="course"
                buttonVariant="outline"
                buttonSize="sm"
              />
            </div>
            <Textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Provide a detailed description of your course..."
              className="min-h-[120px]"
            />
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
              <Label>Thumbnail Image</Label>
              {formData.thumbnail && (
                <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
                  <img 
                    src={formData.thumbnail} 
                    alt="Course thumbnail" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData(prev => ({ ...prev, thumbnail: '' }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="thumbnail-upload"
                  onChange={(e) => handleImageUpload(e, 'thumbnail')}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('thumbnail-upload')?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Thumbnail'}
                </Button>
                {uploading && <Progress value={progress} className="w-[100px]" />}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Cover Image</Label>
              {formData.imageUrl && (
                <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
                  <img 
                    src={formData.imageUrl} 
                    alt="Course cover" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="cover-upload"
                  onChange={(e) => handleImageUpload(e, 'imageUrl')}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('cover-upload')?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
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
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map(tag => (
                <Badge key={tag} variant="secondary" className="group">
                  {tag}
                  <button
                    type="button"
                    className="ml-2 hover:text-destructive"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex space-x-2">
              <Input
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
              <Button type="button" onClick={handleAddTag}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="enrollmentStatus">Enrollment Status</Label>
            <Select 
              value={formData.enrollmentStatus || 'open'} 
              onValueChange={(value) => handleSelectChange('enrollmentStatus', value)}
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
              checked={formData.published}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, published: checked }))}
            />
            <Label>
              {formData.published ? 'Published' : 'Draft'}
            </Label>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => onSave(formData)} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
