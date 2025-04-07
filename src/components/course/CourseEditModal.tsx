import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Course } from '@/types';
import { Upload } from 'lucide-react';

interface CourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Partial<Course>) => void;
  course?: Partial<Course>;
}

const CourseEditModal = ({ isOpen, onClose, onSave, course }: CourseEditModalProps) => {
  const [formData, setFormData] = useState<Partial<Course>>({
    title: '',
    description: '',
    category: '',
    level: 'Beginner',
    imageUrl: '',
    // ... other fields
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (course) {
      setFormData({
        ...course
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
      setFormData(prev => ({ ...prev, imageUrl: '' })); // Clear the URL input when a file is selected
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real implementation, you would upload the image file here
    // and get back a URL to store in the course data
    // For now, we'll just simulate it by using the preview URL
    const courseData = {
      ...formData,
      imageUrl: imagePreview || formData.imageUrl
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
                  name="imageUrl"
                  value={formData.imageUrl || ''}
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
