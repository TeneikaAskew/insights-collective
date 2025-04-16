
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/components/layout/AppLayout';
import ModuleManager from '@/components/course/management/ModuleManager';
import AIContentGenerator from '@/components/ai/AIContentGenerator';
import { ArrowLeft, Save, Plus, Users } from 'lucide-react';
import { useCourseAssignments } from '@/hooks/useCourseAssignments';
import { useUsers } from '@/hooks/useUsers';

const AdminCourseEdit = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, isInstructor, isAdmin, loading: permissionsLoading } = useCoursePermissions(courseId);
  const [course, setCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    category: '',
    level: 'Beginner',
    imageUrl: '',
    published: false,
    tags: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { assignments, addInstructor } = useCourseAssignments(courseId);
  const { users } = useUsers();
  const [activeTab, setActiveTab] = useState('details');
  
  useEffect(() => {
    if (!courseId) {
      setCourse({
        title: '',
        description: '',
        category: '',
        level: 'Beginner',
        imageUrl: '',
        published: false,
        tags: [],
      });
      setLoading(false);
      return;
    }
    
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setCourse(data);
        }
      } catch (error: any) {
        console.error('Error fetching course:', error);
        toast({
          title: 'Error',
          description: 'Failed to load course details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, toast]);
  
  useEffect(() => {
    // Check if the user has permission to edit this course
    if (!permissionsLoading && !canEdit) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to edit this course',
        variant: 'destructive',
      });
      navigate('/courses');
    }
  }, [canEdit, navigate, permissionsLoading, toast]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCourse(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setCourse(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAIContentGenerated = (content: string) => {
    setCourse(prev => ({
      ...prev,
      description: content
    }));
  };
  
  const handleSaveCourse = async () => {
    if (!course.title || !course.description) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title and description for the course',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setSaving(true);
      
      let result;
      
      if (courseId) {
        // Update existing course
        const { data, error } = await supabase
          .from('courses')
          .update({
            title: course.title,
            description: course.description,
            category: course.category,
            level: course.level,
            image_url: course.imageUrl,
            published: course.published,
            tags: course.tags || [],
            updated_at: new Date().toISOString(),
          })
          .eq('id', courseId)
          .select();
        
        if (error) throw error;
        result = data[0];
      } else {
        // Create new course
        const { data, error } = await supabase
          .from('courses')
          .insert({
            title: course.title,
            description: course.description,
            category: course.category,
            level: course.level,
            image_url: course.imageUrl,
            published: false,
            tags: course.tags || [],
            instructor_id: course.instructor?.id,
          })
          .select();
        
        if (error) throw error;
        result = data[0];
      }
      
      toast({
        title: 'Success',
        description: courseId ? 'Course updated successfully' : 'Course created successfully',
      });
      
      if (!courseId) {
        navigate(`/admin/courses/${result.id}/edit`);
      }
    } catch (error: any) {
      console.error('Error saving course:', error);
      toast({
        title: 'Error',
        description: 'Failed to save course',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddInstructor = async (userId: string) => {
    if (!courseId) return;
    
    try {
      await addInstructor(userId);
      toast({
        title: 'Success',
        description: 'Instructor added to course',
      });
    } catch (error) {
      console.error('Error adding instructor:', error);
      toast({
        title: 'Error',
        description: 'Failed to add instructor',
        variant: 'destructive',
      });
    }
  };

  if (loading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading course data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              {courseId ? `Edit Course: ${course.title}` : 'Create New Course'}
            </h1>
          </div>
          <Button onClick={handleSaveCourse} disabled={saving} className="bg-insightBlue hover:bg-insightBlue/90">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Course
              </>
            )}
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="details">Course Details</TabsTrigger>
            {courseId && <TabsTrigger value="modules">Modules & Content</TabsTrigger>}
            {courseId && <TabsTrigger value="instructors">Instructors</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the core details about your course
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Course Title</Label>
                    <Input
                      id="title"
                      name="title"
                      value={course.title || ''}
                      onChange={handleChange}
                      placeholder="Introduction to Data Science"
                      required
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="level">Course Level</Label>
                    <Select
                      value={course.level || 'Beginner'}
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
                  <div className="flex justify-between items-center">
                    <Label htmlFor="description">Course Description</Label>
                    <AIContentGenerator 
                      onContentGenerated={handleAIContentGenerated}
                      contextType="course"
                    />
                  </div>
                  <Textarea
                    id="description"
                    name="description"
                    value={course.description || ''}
                    onChange={handleChange}
                    placeholder="A comprehensive introduction to data science fundamentals..."
                    rows={6}
                    required
                  />
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={course.category || ''}
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
                    <Label htmlFor="imageUrl">Course Image URL</Label>
                    <Input
                      id="imageUrl"
                      name="imageUrl"
                      value={course.imageUrl || ''}
                      onChange={handleChange}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
                
                {isAdmin && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="published"
                      checked={course.published || false}
                      onChange={() => setCourse(prev => ({ ...prev, published: !prev.published }))}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="published" className="cursor-pointer">
                      Publish this course (make it visible to students)
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {courseId && (
            <TabsContent value="modules" className="space-y-4 mt-4">
              <ModuleManager courseId={courseId} />
            </TabsContent>
          )}
          
          {courseId && (
            <TabsContent value="instructors" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Course Instructors</CardTitle>
                  <CardDescription>
                    Manage instructors assigned to this course
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Instructor
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Role
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assignments && assignments.length > 0 ? (
                            assignments.map((assignment) => (
                              <tr key={assignment.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {assignment.profile?.avatar_url ? (
                                      <img 
                                        className="h-10 w-10 rounded-full" 
                                        src={assignment.profile.avatar_url} 
                                        alt="" 
                                      />
                                    ) : (
                                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-gray-500">
                                          {assignment.profile?.first_name?.[0] || ''}
                                          {assignment.profile?.last_name?.[0] || ''}
                                        </span>
                                      </div>
                                    )}
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">
                                        {assignment.profile?.first_name} {assignment.profile?.last_name}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{assignment.role}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <Button variant="ghost" className="text-red-600 hover:text-red-900">
                                    Remove
                                  </Button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                No instructors assigned to this course yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    {isAdmin && (
                      <div className="mt-4">
                        <div className="flex items-center space-x-2">
                          <Select onValueChange={(value) => handleAddInstructor(value)}>
                            <SelectTrigger className="w-[300px]">
                              <SelectValue placeholder="Add instructor to course..." />
                            </SelectTrigger>
                            <SelectContent>
                              {users.filter(user => 
                                !assignments.some(a => a.user_id === user.id)
                              ).map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.first_name} {user.last_name} ({user.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Instructor
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminCourseEdit;
