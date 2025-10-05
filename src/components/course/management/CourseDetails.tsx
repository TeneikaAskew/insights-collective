
import React, { useState, useEffect, useRef } from 'react';
import { Course } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, X } from 'lucide-react';
import CourseInstructorAccess from '@/components/course/CourseInstructorAccess';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseDetails');

interface CourseDetailsProps {
  course: Course | null;
}

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

export default function CourseDetails({ course }: CourseDetailsProps) {
  const [formData, setFormData] = useState({
    title: course?.title || '',
    description: course?.description || '',
    category: course?.category || '',
    level: course?.level || 'Beginner',
    duration: course?.duration || '',
    enrollmentStatus: course?.enrollmentStatus || 'open',
    status: course?.status || 'draft',
    instructor_id: course?.instructor_id || '',
    tags: course?.tags || [],
    image_url: course?.imageUrl || course?.thumbnail || '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(course?.imageUrl || course?.thumbnail || null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch available instructors
  useEffect(() => {
    const fetchInstructors = async () => {
      setLoadingInstructors(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .or('role.eq.instructor,role.eq.admin')
          .order('first_name');

        if (error) throw error;
        setInstructors(data || []);
      } catch (error) {
        logger.error('Error fetching instructors:', error);
        toast({
          title: 'Error',
          description: 'Failed to load instructors',
          variant: 'destructive',
        });
      } finally {
        setLoadingInstructors(false);
      }
    };

    fetchInstructors();
  }, [toast]);

  // Update form data when course changes
  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        description: course.description || '',
        category: course.category || '',
        level: course.level || 'Beginner',
        duration: course.duration || '',
        enrollmentStatus: course.enrollmentStatus || 'open',
        status: course.status || 'draft',
        instructor_id: course.instructor_id || '',
        tags: course.tags || [],
        image_url: course.imageUrl || course.thumbnail || '',
      });
      setImagePreview(course.imageUrl || course.thumbnail || null);
    }
  }, [course]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setFormData(prev => ({ ...prev, image_url: '' }));
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    if (!formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
    }
    
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag) || []
    }));
  };

  const handleSave = async () => {
    if (!course?.id) return;
    
    setIsLoading(true);
    
    try {
      // Upload image if selected
      let newImageUrl = formData.image_url;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `courses/${course.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('course-images')
          .upload(filePath, imageFile);
          
        if (uploadError) {
          throw uploadError;
        }
        
        // Get public URL for the image
        const { data: urlData } = supabase.storage
          .from('course-images')
          .getPublicUrl(filePath);
          
        newImageUrl = urlData.publicUrl;
      } else if (imagePreview && imagePreview !== course.imageUrl) {
        newImageUrl = imagePreview;
      }
      
      // Update course in database
      const { error } = await supabase
        .from('courses')
        .update({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          level: formData.level,
          duration: formData.duration,
          enrollment_status: formData.enrollmentStatus,
          status: formData.status,
          published: formData.status === 'published',
          image_url: newImageUrl,
          tags: formData.tags,
          instructor_id: formData.instructor_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', course.id);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Course details updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update course details',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Course Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={4}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleSelectChange('category', value)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Data Science">Data Science</SelectItem>
                        <SelectItem value="Analytics & Business Intelligence">Analytics & Business Intelligence</SelectItem>
                        <SelectItem value="Data Engineering">Data Engineering</SelectItem>
                        <SelectItem value="Machine Learning & Artificial Intelligence">Machine Learning & Artificial Intelligence</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="level">Level</Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value) => handleSelectChange('level', value)}
                    >
                      <SelectTrigger id="level">
                        <SelectValue placeholder="Select a level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2 max-w-md">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    placeholder="e.g., 8 weeks, 40 hours"
                  />
                </div>
              </div>
            </div>

            {/* Instructor Assignment */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Instructor</h3>
              <div className="grid gap-2 max-w-md">
                <Label htmlFor="instructor">Assign Instructor</Label>
                <Select
                  value={formData.instructor_id}
                  onValueChange={(value) => handleSelectChange('instructor_id', value)}
                  disabled={loadingInstructors}
                >
                  <SelectTrigger id="instructor">
                    <SelectValue
                      placeholder={loadingInstructors ? "Loading instructors..." : "Select an instructor"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.first_name} {instructor.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Course Image */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Course Image</h3>
              <div className="space-y-4">
                {imagePreview && (
                  <div className="relative w-full h-40 overflow-hidden rounded-md border">
                    <img 
                      src={imagePreview} 
                      alt="Course preview" 
                      className="object-cover w-full h-full" 
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleTriggerFileInput}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Image</span>
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <span className="text-sm text-muted-foreground">or</span>
                </div>
                <Input
                  placeholder="Image URL (optional)"
                  name="image_url"
                  value={formData.image_url}
                  onChange={(e) => {
                    handleChange(e);
                    if (e.target.value) {
                      setImagePreview(e.target.value);
                      setImageFile(null);
                    } else {
                      setImagePreview(null);
                    }
                  }}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Tags</h3>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {formData.tags?.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddTag} variant="outline">
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Course Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Course Settings</h3>
              <div className="grid gap-4 max-w-md">
                <div className="grid gap-2">
                  <Label htmlFor="enrollment_status">Enrollment Status</Label>
                  <Select
                    value={formData.enrollmentStatus}
                    onValueChange={(value) => handleSelectChange('enrollmentStatus', value)}
                  >
                    <SelectTrigger id="enrollment_status">
                      <SelectValue placeholder="Select enrollment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="waitlist">Waitlist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Course Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleSelectChange('status', value)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select course status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          
          {course?.enrollmentCount !== undefined && (
            <div className="mt-4">
              <Alert>
                <AlertTitle>Course Statistics</AlertTitle>
                <AlertDescription>
                  <div className="flex justify-between items-center">
                    <span>Enrollments</span>
                    <span className="font-bold">{course.enrollmentCount}</span>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {course?.id && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Course Instructors</h3>
            <CourseInstructorAccess courseId={course.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
