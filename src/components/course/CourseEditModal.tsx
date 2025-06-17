
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Course } from '@/types';
import { CourseFormData } from '@/types/course';
import { Upload, Settings, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface CourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Partial<CourseFormData>) => void;
  course?: Partial<Course>;
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

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available instructors
  useEffect(() => {
    const fetchInstructors = async () => {
      setLoadingInstructors(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .or('role.eq.instructor,role.eq.admin,roles.cs.{instructor},roles.cs.{admin}')
          .order('first_name');

        if (error) throw error;
        setInstructors(data || []);
      } catch (error) {
        console.error('Error fetching instructors:', error);
      } finally {
        setLoadingInstructors(false);
      }
    };

    if (isOpen) {
      fetchInstructors();
    }
  }, [isOpen]);

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        description: course.description || '',
        category: course.category || '',
        level: course.level || 'Beginner',
        duration: course.duration || '',
        tags: course.tags || [],
        // Map frontend properties to database field names
        image_url: course.imageUrl || course.image_url || '',
        enrollment_status: course.enrollmentStatus || course.enrollment_status || 'open',
        published: course.published || false,
        status: course.status || 'draft',
        instructor_id: course.instructor_id || course.instructor?.id || '',
      });
      setImagePreview(course.imageUrl || course.image_url || null);
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
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setFormData(prev => ({ ...prev, image_url: '' })); // Clear the URL input when a file is selected
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean the data to only include database fields and remove frontend-only properties
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
    
    onSave(courseData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{course?.id ? 'Edit Course' : 'Create New Course'}</DialogTitle>
            {course?.id && (
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/course-manage-materials?courseId=${course.id}`} target="_blank">
                    <Settings className="h-4 w-4 mr-1" />
                    Manage Materials
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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
              />
            </div>
            
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

            <div className="grid gap-2">
              <Label htmlFor="instructor">Instructor</Label>
              <Select
                value={formData.instructor_id || ''}
                onValueChange={(value) => handleSelectChange('instructor_id', value)}
              >
                <SelectTrigger id="instructor">
                  <SelectValue placeholder={loadingInstructors ? "Loading instructors..." : "Select an instructor"} />
                </SelectTrigger>
                <SelectContent>
                  {instructors.map((instructor) => (
                    <SelectItem key={instructor.id} value={instructor.id}>
                      {`${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'Unnamed Instructor'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            
            {/* Image upload field */}
            <div className="grid gap-2">
              <Label>Course Image</Label>
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
                <p className="text-sm text-muted-foreground">
                  Upload an image or provide a URL for the course thumbnail.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CourseEditModal;
