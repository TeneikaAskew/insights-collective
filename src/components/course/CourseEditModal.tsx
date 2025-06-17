import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Course } from '@/types';
import { CourseFormData } from '@/types/course';
import { Upload } from 'lucide-react';

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
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        image_url: course.imageUrl || '',
        enrollment_status: course.enrollmentStatus || 'open',
        published: course.published || false,
        status: 'draft', // Default status since Course type doesn't have this property
      });
      setImagePreview(course.imageUrl || null);
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
    };
    
    onSave(courseData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{course?.id ? 'Edit Course' : 'Create New Course'}</DialogTitle>
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
            
            {/* Add more fields as needed */}
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
