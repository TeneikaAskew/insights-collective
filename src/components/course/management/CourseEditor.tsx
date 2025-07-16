
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useCourseAssignments } from '@/hooks/useCourseAssignments';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Save, Trash2, Plus, ArrowLeft, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import CourseModuleManager from './CourseModuleManager';
import AppLayout from '@/components/layout/AppLayout';
import { useUsers } from '@/hooks/useUsers';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseEditor');

const CourseEditor = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const isNewCourse = courseId === 'new';
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canEdit, isAdmin, loading: permissionsLoading } = useCoursePermissions(isNewCourse ? undefined : courseId);
  const { assignments, addInstructor, removeInstructor, loading: assignmentsLoading } = useCourseAssignments(isNewCourse ? undefined : courseId);
  const { users, loading: usersLoading } = useUsers();
  const { uploadFile, uploading, progress } = useStorageUpload();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState({
    id: '',
    title: '',
    description: '',
    category: '',
    level: 'Beginner',
    published: false,
    image_url: '',
    thumbnail: '',
    instructor_id: '',
    tags: [] as string[],
    duration: '',
    enrollment_status: 'open'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTag, setNewTag] = useState('');
  
  useEffect(() => {
    if (isNewCourse) {
      // Set default instructor to current user
      setCourse(prev => ({
        ...prev,
        instructor_id: user?.id || ''
      }));
      setLoading(false);
      return;
    }
    
    const fetchCourse = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        
        setCourse({
          ...data,
          tags: data.tags || []
        });
      } catch (error: any) {
        logger.error('Error fetching course:', error);
        toast({
          title: 'Error',
          description: 'Failed to load course data',
          variant: 'destructive',
        });
        navigate('/admin/courses');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, isNewCourse, navigate, toast, user?.id]);
  
  // Check if user can access this page
  useEffect(() => {
    if (!permissionsLoading && !canEdit && !isNewCourse) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to edit this course',
        variant: 'destructive',
      });
      navigate('/admin/courses');
    }
  }, [canEdit, permissionsLoading, isNewCourse, navigate, toast]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCourse(prev => ({
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
    setCourse(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    if (!course.tags.includes(newTag.trim())) {
      setCourse(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
    }
    
    setNewTag('');
  };
  
  const handleRemoveTag = (tag: string) => {
    setCourse(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image_url' | 'thumbnail') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await uploadFile(file, 'module-content', `courses/${type}`);
    if (result) {
      setCourse(prev => ({
        ...prev,
        [type]: result.publicUrl
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!course.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!course.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!course.category.trim()) {
      newErrors.category = 'Category is required';
    }
    
    if (!course.level.trim()) {
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
        ...course,
        instructor_id: course.instructor_id || user?.id
      };
      
      let result;
      
      if (isNewCourse) {
        // Create new course
        const { data, error } = await supabase
          .from('courses')
          .insert(courseData)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
        
        // Create assignment for the instructor
        if (user?.id) {
          await supabase.from('course_assignments').insert({
            user_id: user.id,
            course_id: data.id,
            role: 'instructor'
          });
        }
        
        toast({
          title: 'Success',
          description: 'Course created successfully',
        });
      } else {
        // Update existing course
        const { data, error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', courseId)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
        
        toast({
          title: 'Success',
          description: 'Course updated successfully',
        });
      }
      
      navigate(`/admin/courses/${result.id}/edit`);
    } catch (error: any) {
      logger.error('Error saving course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save course',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Filter out users who are already assigned
  const availableUsers = users.filter(u => 
    !assignments.some(a => a.user_id === u.id)
  );
  
  if (loading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6">
          <div className="flex justify-center py-20">
            <Progress value={30} className="w-1/2 animate-pulse" />
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => navigate('/admin/courses')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
            <h1 className="text-3xl font-bold">
              {isNewCourse ? 'Create New Course' : 'Edit Course'}
            </h1>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Course'}
          </Button>
        </div>
        
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
        
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Course Details</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            {isAdmin && <TabsTrigger value="instructors">Instructors</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="details" className="space-y-6 pt-4">
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
                    <Label htmlFor="title" className={errors.title ? 'text-destructive' : ''}>
                      Course Title
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      value={course.title}
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
                      value={course.category}
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
                      name="level" 
                      value={course.level} 
                      onValueChange={(value) => {
                        setCourse(prev => ({ ...prev, level: value }));
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
                      value={course.duration || ''}
                      onChange={handleChange}
                      placeholder="e.g., 8 weeks"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label 
                      htmlFor="description" 
                      className={errors.description ? 'text-destructive' : ''}
                    >
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={course.description}
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
                    {course.thumbnail && (
                      <div className="relative w-full aspect-video rounded-md overflow-hidden">
                        <img 
                          src={course.thumbnail} 
                          alt="Course thumbnail" 
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setCourse(prev => ({ ...prev, thumbnail: '' }))}
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
                    {course.image_url && (
                      <div className="relative w-full aspect-video rounded-md overflow-hidden">
                        <img 
                          src={course.image_url} 
                          alt="Course cover" 
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setCourse(prev => ({ ...prev, image_url: '' }))}
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
                    {course.tags.map(tag => (
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
                    name="enrollment_status" 
                    value={course.enrollment_status} 
                    onValueChange={(value) => {
                      setCourse(prev => ({ ...prev, enrollment_status: value }));
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
                    checked={course.published}
                    onCheckedChange={(checked) => handleSwitchChange(checked, 'published')}
                  />
                  <Label htmlFor="published">
                    {course.published ? 'Published' : 'Draft'}
                  </Label>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleSubmit} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Course'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="modules" className="pt-4">
            {!isNewCourse ? (
              <CourseModuleManager courseId={courseId} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Modules</CardTitle>
                  <CardDescription>
                    You need to save the course first before you can add modules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-10">
                  <Button onClick={handleSubmit} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Course to Add Modules'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="instructors" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Course Instructors</CardTitle>
                  <CardDescription>
                    Manage instructors for this course. Instructors can create and edit course content.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!isNewCourse ? (
                    <>
                      <div className="space-y-4">
                        <Label>Assigned Instructors</Label>
                        {assignmentsLoading ? (
                          <div className="py-4 flex justify-center">
                            <Progress value={30} className="w-1/3 animate-pulse" />
                          </div>
                        ) : assignments.length > 0 ? (
                          <div className="space-y-2">
                            {assignments.map(assignment => (
                              <div 
                                key={assignment.id} 
                                className="flex items-center justify-between p-3 border rounded-md"
                              >
                                <div className="flex items-center space-x-3">
                                  <Avatar>
                                    <AvatarImage 
                                      src={assignment.profile?.avatar_url || ''} 
                                      alt={`${assignment.profile?.first_name || ''} ${assignment.profile?.last_name || ''}`} 
                                    />
                                    <AvatarFallback>
                                      {(assignment.profile?.first_name?.[0] || '') + 
                                       (assignment.profile?.last_name?.[0] || '')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">
                                      {assignment.profile?.first_name} {assignment.profile?.last_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {assignment.role}
                                    </p>
                                  </div>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => removeInstructor(assignment.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Remove</span>
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-4 text-center text-muted-foreground">
                            No instructors assigned yet.
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <Label htmlFor="add-instructor">Add Instructor</Label>
                        <div className="flex space-x-2">
                          <Select 
                            onValueChange={(userId) => {
                              if (userId) {
                                addInstructor(userId);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                            <SelectContent>
                              {usersLoading ? (
                                <div className="py-2 px-4 text-center">Loading users...</div>
                              ) : availableUsers.length > 0 ? (
                                availableUsers.map(u => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="py-2 px-4 text-center">No available users</div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground">
                      Save the course first to manage instructors.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CourseEditor;
