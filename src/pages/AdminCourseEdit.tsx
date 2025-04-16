
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';
import ModuleManager from '@/components/course/management/ModuleManager';
import AIContentGenerator from '@/components/ai/AIContentGenerator';
import { ArrowLeft, Save, Plus, Trash } from 'lucide-react';
import { CourseDetailsForm } from '@/components/course/CourseDetailsForm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AdminCourseEdit = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, isInstructor, isAdmin, loading: permissionsLoading } = useCoursePermissions(courseId);
  const [course, setCourse] = useState<Partial<Course>>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [instructors, setInstructors] = useState<any[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles(
              id,
              first_name,
              last_name
            )
          `)
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          const transformedCourse: Partial<Course> = {
            id: data.id,
            title: data.title,
            description: data.description,
            category: data.category,
            level: data.level,
            duration: data.duration,
            tags: data.tags,
            thumbnail: data.thumbnail,
            imageUrl: data.image_url,
            enrollmentStatus: data.enrollment_status,
            published: data.published,
            instructor: data.instructor ? {
              id: data.instructor.id,
              name: `${data.instructor.first_name || ''} ${data.instructor.last_name || ''}`.trim(),
              firstName: data.instructor.first_name,
              lastName: data.instructor.last_name
            } : undefined
          };
          
          setCourse(transformedCourse);
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
    if (!courseId || !isAdmin) return;
    
    const fetchInstructors = async () => {
      try {
        const { data, error } = await supabase
          .from('course_assignments')
          .select(`
            *,
            profile:profiles(
              id,
              first_name,
              last_name,
              avatar_url,
              email
            )
          `)
          .eq('course_id', courseId)
          .eq('role', 'instructor');

        if (error) {
          console.error('Error fetching instructors:', error);
          return;
        }

        const formattedInstructors = data.map((instructor) => ({
          userId: instructor.user_id,
          courseId: instructor.course_id,
          role: instructor.role,
          profile: instructor.profile ? {
            id: instructor.profile.id,
            firstName: instructor.profile.first_name,
            lastName: instructor.profile.last_name,
            avatarUrl: instructor.profile.avatar_url,
          } : undefined
        }));

        setInstructors(formattedInstructors);
      } catch (error) {
        console.error('Error fetching instructors:', error);
      }
    };

    fetchInstructors();
  }, [courseId, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchAvailableProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            avatar_url
          `);

        if (error) {
          console.error('Error fetching profiles:', error);
          return;
        }

        const formattedProfiles = data.map((profile) => ({
          id: profile.id,
          firstName: profile.first_name,
          lastName: profile.last_name,
          avatarUrl: profile.avatar_url,
        }));

        setAvailableProfiles(formattedProfiles);
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    };

    fetchAvailableProfiles();
  }, [isAdmin]);

  const handleSave = async (updatedCourse: Partial<Course>) => {
    try {
      setSaving(true);
      
      const dbCourse = {
        title: updatedCourse.title,
        description: updatedCourse.description,
        category: updatedCourse.category,
        level: updatedCourse.level,
        duration: updatedCourse.duration,
        tags: updatedCourse.tags,
        thumbnail: updatedCourse.thumbnail,
        image_url: updatedCourse.imageUrl,
        enrollment_status: updatedCourse.enrollmentStatus,
        published: updatedCourse.published,
      };
      
      const { data, error } = await supabase
        .from('courses')
        .update(dbCourse)
        .eq('id', courseId as string)
        .select()
        .single();
      
      if (error) throw error;
      
      const transformedData: Partial<Course> = {
        ...updatedCourse,
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        level: data.level,
        duration: data.duration,
        tags: data.tags,
        thumbnail: data.thumbnail,
        imageUrl: data.image_url,
        enrollmentStatus: data.enrollment_status,
        published: data.published
      };
      
      setCourse(transformedData);
      
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

  const addInstructor = async () => {
    if (!selectedProfileId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an instructor",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('course_assignments')
        .insert([
          {
            course_id: courseId,
            user_id: selectedProfileId,
            role: 'instructor',
          },
        ])
        .select();

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add instructor. They may already be assigned to this course.",
        });
        console.error('Error adding instructor:', error);
        return;
      }

      toast({
        title: "Success",
        description: "Instructor added successfully",
      });
      
      setIsDialogOpen(false);
      setSelectedProfileId('');
      
      const profile = availableProfiles.find(p => p.id === selectedProfileId);
      if (profile && data[0]) {
        setInstructors([...instructors, {
          userId: data[0].user_id,
          courseId: data[0].course_id,
          role: data[0].role,
          profile: {
            id: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            avatarUrl: profile.avatarUrl,
          }
        }]);
      }
    } catch (error) {
      console.error('Error adding instructor:', error);
    }
  };

  const removeInstructor = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('course_assignments')
        .delete()
        .eq('course_id', courseId)
        .eq('user_id', userId);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to remove instructor",
        });
        console.error('Error removing instructor:', error);
        return;
      }

      toast({
        title: "Success",
        description: "Instructor removed successfully",
      });
      
      setInstructors(instructors.filter(instructor => instructor.userId !== userId));
    } catch (error) {
      console.error('Error removing instructor:', error);
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
      <div className="container max-w-full py-6">
        <div className="space-y-6">
          <div className="border-b pb-4">
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Courses
              </Button>
            </div>
            
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Edit Course</h1>
                {course?.title && (
                  <p className="text-lg text-muted-foreground mt-1">{course.title}</p>
                )}
              </div>
              <Button onClick={() => handleSave(course as Course)} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Course'}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start border-b">
              <TabsTrigger value="details" className="flex-1">Course Details</TabsTrigger>
              <TabsTrigger value="modules" className="flex-1">Modules & Content</TabsTrigger>
              {isAdmin && <TabsTrigger value="instructors" className="flex-1">Instructors</TabsTrigger>}
            </TabsList>

            <div className="mt-6 space-y-6 w-full">
              <TabsContent value="details" className="w-full mt-0">
                {course && (
                  <CourseDetailsForm 
                    course={course} 
                    onSave={handleSave}
                    loading={saving}
                  />
                )}
              </TabsContent>

              <TabsContent value="modules" className="w-full mt-0">
                {courseId && <ModuleManager courseId={courseId} />}
              </TabsContent>

              {isAdmin && (
                <TabsContent value="instructors" className="w-full mt-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Course Instructors</h3>
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Instructor
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Instructor</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label htmlFor="instructor-select" className="text-sm font-medium">
                                Select Instructor
                              </label>
                              <Select
                                value={selectedProfileId}
                                onValueChange={setSelectedProfileId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select an instructor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableProfiles.map((profile) => (
                                    <SelectItem key={profile.id} value={profile.id}>
                                      {profile.firstName} {profile.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={addInstructor}>Add Instructor</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {instructors.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                No instructors assigned to this course
                              </TableCell>
                            </TableRow>
                          ) : (
                            instructors.map((instructor) => (
                              <TableRow key={instructor.userId}>
                                <TableCell>
                                  {instructor.profile?.firstName} {instructor.profile?.lastName}
                                </TableCell>
                                <TableCell>{instructor.role}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeInstructor(instructor.userId)}
                                  >
                                    <Trash className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Remove</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminCourseEdit;
