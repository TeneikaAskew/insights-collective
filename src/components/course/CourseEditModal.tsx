import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Course } from '@/types';
import { CourseFormData } from '@/types/course';
import { Upload, ExternalLink, Settings, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Partial<CourseFormData>) => void;
  course?: Partial<Course>;
}

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

// Form data type that matches database fields
interface CourseFormFields {
  title: string;
  description: string;
  category: string;
  level: string;
  duration: string;
  tags: string[];
  image_url: string;
  enrollment_status: string;
  published: boolean;
  status: string;
  instructor_id: string;
}

const CourseEditModal = ({ isOpen, onClose, onSave, course }: CourseEditModalProps) => {
  const [formData, setFormData] = useState<Partial<CourseFormFields>>({
    title: '',
    description: '',
    category: '',
    level: 'Beginner',
    image_url: '',
    duration: '',
    tags: [],
    enrollment_status: 'open',
    published: false,
    status: 'draft',
    instructor_id: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch available instructors
  useEffect(() => {
    const fetchInstructors = async () => {
      setLoadingInstructors(true);
      try {
        console.log('Fetching instructors...');
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .or('role.eq.instructor,role.eq.admin')
          .order('first_name');

        if (error) {
          console.error('Error fetching instructors:', error);
          throw error;
        }
        
        console.log('Fetched instructors:', data);
        setInstructors(data || []);
      } catch (error) {
        console.error('Error fetching instructors:', error);
        toast({
          title: 'Error',
          description: 'Failed to load instructors',
          variant: 'destructive',
        });
      } finally {
        setLoadingInstructors(false);
      }
    };

    if (isOpen) {
      fetchInstructors();
    }
  }, [isOpen, toast]);

  // Populate form data when course prop changes
  useEffect(() => {
    if (course) {
      console.log('Setting form data from course:', course);
      
      setFormData({
        title: course.title || '',
        description: course.description || '',
        category: course.category || '',
        level: course.level || 'Beginner',
        duration: course.duration || '',
        tags: course.tags || [],
        image_url: course.imageUrl || course.image_url || '',
        enrollment_status: course.enrollmentStatus || course.enrollment_status || 'open',
        published: course.published || false,
        status: course.status || 'draft',
        // Fix: Use instructor_id directly from course, not nested instructor object
        instructor_id: course.instructor_id || '',
      });
      
      console.log('Form instructor_id set to:', course.instructor_id);
      setImagePreview(course.imageUrl || course.image_url || null);
    } else {
      // Reset form for new course
      setFormData({
        title: '',
        description: '',
        category: '',
        level: 'Beginner',
        image_url: '',
        duration: '',
        tags: [],
        enrollment_status: 'open',
        published: false,
        status: 'draft',
        instructor_id: '',
      });
      setImagePreview(null);
    }
  }, [course]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    console.log(`Setting ${name} to:`, value);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
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

  const handleOpenMaterials = () => {
    if (course?.id) {
      const url = `/course-management?courseId=${course.id}&tab=content`;
      window.open(url, '_blank');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Submitting form data:', formData);
    
    const courseData: Partial<CourseFormData> = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      level: formData.level,
      duration: formData.duration,
      tags: formData.tags,
      image_url: imagePreview || formData.image_url,
      enrollment_status: formData.enrollment_status as 'open' | 'closed' | 'waitlist' || 'open',
      published: formData.published,
      status: formData.status as 'draft' | 'published' | 'archived' || 'draft',
      instructor_id: formData.instructor_id,
    };
    
    console.log('Calling onSave with:', courseData);
    onSave(courseData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {course?.id ? 'Edit Course' : 'Create New Course'}
            {course?.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenMaterials}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Edit Materials
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Course Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title || ''}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description || ''}
                    onChange={handleChange}
                    required
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category || ''}
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
                      value={formData.level || 'Beginner'}
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

                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    name="duration"
                    value={formData.duration || ''}
                    onChange={handleChange}
                    placeholder="e.g., 8 weeks, 40 hours"
                  />
                </div>
              </div>
            </div>

            {/* Instructor Assignment */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Instructor</h3>
              <div className="grid gap-2">
                <Label htmlFor="instructor">Assign Instructor</Label>
                <Select
                  value={formData.instructor_id || ''}
                  onValueChange={(value) => handleSelectChange('instructor_id', value)}
                  disabled={loadingInstructors}
                >
                  <SelectTrigger id="instructor">
                    <SelectValue placeholder={loadingInstructors ? "Loading instructors..." : "Select an instructor"} />
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
              {formData.instructor_id && (
                <div className="text-sm text-muted-foreground">
                  Current instructor ID: {formData.instructor_id}
                </div>
              )}
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
                  value={formData.image_url || ''}
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
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="enrollment_status">Enrollment Status</Label>
                  <Select
                    value={formData.enrollment_status || 'open'}
                    onValueChange={(value) => handleSelectChange('enrollment_status', value)}
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
                    value={formData.status || 'draft'}
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

                <div className="flex items-center space-x-2">
                  <Switch
                    id="published"
                    checked={formData.published || false}
                    onCheckedChange={(checked) => handleSwitchChange('published', checked)}
                  />
                  <Label htmlFor="published">Published</Label>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Course</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CourseEditModal;
