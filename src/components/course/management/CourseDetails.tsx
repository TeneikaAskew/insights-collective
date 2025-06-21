
import React, { useState } from 'react';
import { Course } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Image, Trash2 } from 'lucide-react';
import CourseInstructorAccess from '@/components/course/CourseInstructorAccess';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CourseDetailsProps {
  course: Course | null;
}

export default function CourseDetails({ course }: CourseDetailsProps) {
  const [formData, setFormData] = useState({
    title: course?.title || '',
    description: course?.description || '',
    category: course?.category || '',
    level: course?.level || 'Beginner',
    duration: course?.duration || '',
    enrollmentStatus: course?.enrollmentStatus || 'open',
    published: course?.published || false,
    tags: (course?.tags || []).join(', '),
  });
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState(course?.imageUrl || course?.thumbnail || '');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      setImageUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSave = async () => {
    if (!course?.id) return;
    
    setIsLoading(true);
    
    try {
      // Upload image if selected
      let newImageUrl = course.imageUrl;
      
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `courses/${course.id}/${fileName}`;
        
        const { error: uploadError, data: fileData } = await supabase.storage
          .from('course-images')
          .upload(filePath, image);
          
        if (uploadError) {
          throw uploadError;
        }
        
        // Get public URL for the image
        const { data: urlData } = supabase.storage
          .from('course-images')
          .getPublicUrl(filePath);
          
        newImageUrl = urlData.publicUrl;
      }
      
      // Process tags from comma-separated string to array
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
      
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
          published: formData.published,
          image_url: newImageUrl,
          tags: tagsArray,
          updated_at: new Date().toISOString(),
        })
        .eq('id', course.id);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Course details updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating course:', error);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Course Title</Label>
                <Input 
                  id="title" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange} 
                  placeholder="Enter course title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange} 
                  placeholder="Enter course description"
                  rows={5}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleSelectChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AI/ML">AI/ML</SelectItem>
                      <SelectItem value="Data Engineering">Data Engineering</SelectItem>
                      <SelectItem value="Analytics">Analytics</SelectItem>
                      <SelectItem value="Business Intelligence">Business Intelligence</SelectItem>
                      <SelectItem value="Data Science">Data Science</SelectItem>
                      <SelectItem value="Programming">Programming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Select 
                    value={formData.level} 
                    onValueChange={(value) => handleSelectChange('level', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input 
                    id="duration" 
                    name="duration" 
                    value={formData.duration} 
                    onChange={handleChange} 
                    placeholder="e.g., 6 weeks"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="enrollmentStatus">Enrollment Status</Label>
                  <Select 
                    value={formData.enrollmentStatus} 
                    onValueChange={(value) => handleSelectChange('enrollmentStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="coming_soon">Coming Soon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input 
                  id="tags" 
                  name="tags" 
                  value={formData.tags} 
                  onChange={handleChange} 
                  placeholder="e.g., python, data analysis, visualization"
                />
                <p className="text-xs text-muted-foreground">These tags will appear in the Course Overview section</p>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch 
                  id="published" 
                  checked={formData.published} 
                  onCheckedChange={(checked) => handleSwitchChange('published', checked)} 
                />
                <Label htmlFor="published">Published</Label>
              </div>
            </div>
            
            <div>
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Course Image</Label>
                  <div className="border rounded-md overflow-hidden bg-gray-50 h-48 flex items-center justify-center">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt="Course preview" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <span>No image selected</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => document.getElementById('course-image')?.click()}
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Select Image
                  </Button>
                  
                  {imageUrl && (
                    <Button 
                      variant="outline" 
                      className="flex-shrink-0" 
                      onClick={() => {
                        setImage(null);
                        setImageUrl('');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <input 
                    id="course-image" 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                  />
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
              </div>
            </div>
          </div>
          
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
