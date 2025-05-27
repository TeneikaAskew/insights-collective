
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Calendar, Clock, Users, Star, Play, CheckCircle, Lock, MessageSquare, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types';
import EnrollmentBadge from '@/components/course/EnrollmentBadge';

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [forums, setForums] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    
    const fetchCourse = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles(
              id,
              first_name,
              last_name,
              avatar_url,
              bio
            )
          `)
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        const formattedCourse: Course = {
          ...data,
          instructor: {
            id: data.instructor?.id || data.instructor_id || '',
            name: data.instructor 
              ? `${data.instructor?.first_name || ''} ${data.instructor?.last_name || ''}`.trim()
              : 'Instructor',
            email: '',
            role: 'instructor',
            avatar: data.instructor?.avatar_url || '',
            bio: data.instructor?.bio || '',
          },
          enrollmentCount: 0,
          modules: [],
          rating: 4.5,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          thumbnail: data.image_url || data.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
        };
        
        setCourse(formattedCourse);
        
        // Check if user is enrolled
        if (user) {
          const { data: enrollmentData } = await supabase
            .from('enrollments')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', id)
            .single();
            
          setIsEnrolled(!!enrollmentData);
        }
        
        // Fetch course forums
        const { data: forumsData } = await supabase
          .from('forums')
          .select('*')
          .eq('course_id', id);
          
        setForums(forumsData || []);
        
      } catch (error: any) {
        console.error('Error fetching course:', error);
        toast({
          title: "Failed to load course",
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [id, user, toast]);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (!user || !course) return;
    
    try {
      setEnrolling(true);
      
      const { error } = await supabase
        .from('enrollments')
        .insert({
          user_id: user.id,
          course_id: course.id,
          enrolled_at: new Date().toISOString(),
          completion_status: 0
        });
        
      if (error) throw error;
      
      setIsEnrolled(true);
      toast({
        title: "Successfully enrolled!",
        description: `You are now enrolled in ${course.title}`,
      });
      
    } catch (error: any) {
      console.error('Error enrolling in course:', error);
      toast({
        title: "Enrollment failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setEnrolling(false);
    }
  };

  const courseDuration = useMemo(() => {
    if (!course?.modules?.length) return "Self-paced";
    const totalMinutes = course.modules.reduce((total, module) => total + (module.duration || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [course]);

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </AppLayout>
    );
  }

  if (!course) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Course not found</h2>
          <Button onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/courses')}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Courses
        </Button>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="aspect-video overflow-hidden rounded-t-lg">
                <img 
                  src={course.thumbnail} 
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{course.category}</Badge>
                      <Badge variant="outline">{course.level}</Badge>
                    </div>
                    <CardTitle className="text-2xl">{course.title}</CardTitle>
                    <CardDescription className="text-lg">
                      {course.description}
                    </CardDescription>
                  </div>
                  <EnrollmentBadge courseId={course.id} />
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                <TabsTrigger value="instructor">Instructor</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="forums">Forums</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>About this course</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {course.description}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>What you'll learn</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {course.learning_objectives ? (
                      course.learning_objectives.map((objective, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{objective}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Learning objectives not specified.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="curriculum" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Course Content</CardTitle>
                    <CardDescription>
                      {course.modules?.length || 0} modules • {courseDuration}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {course.modules?.length ? (
                      course.modules.map((module, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            {isEnrolled ? (
                              <Play className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Lock className="h-5 w-5 text-gray-400" />
                            )}
                            <div>
                              <h4 className="font-medium">{module.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {module.duration ? `${module.duration} min` : 'Duration not specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Course curriculum will be available soon.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="instructor" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Meet your instructor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={course.instructor.avatar} />
                        <AvatarFallback>
                          <User className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg">{course.instructor.name}</h3>
                        <p className="text-muted-foreground">
                          {course.instructor.bio || 'Experienced instructor passionate about teaching.'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="reviews" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No reviews yet. Be the first to review this course!</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="forums" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Course Forums</CardTitle>
                    <CardDescription>Discuss with fellow students and instructors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {forums.length > 0 ? (
                      <div className="space-y-3">
                        {forums.map((forum) => (
                          <div 
                            key={forum.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/courses/${course.id}/forums/${forum.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <MessageSquare className="h-5 w-5 text-blue-600" />
                              <div>
                                <h4 className="font-medium">{forum.title}</h4>
                                <p className="text-sm text-muted-foreground">{forum.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No forums available for this course yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Duration: {courseDuration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{course.enrollmentCount} students enrolled</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4" />
                    <span>{course.rating} rating</span>
                  </div>
                </div>

                <Separator />

                {isEnrolled ? (
                  <Button className="w-full" size="lg">
                    <Play className="mr-2 h-5 w-5" />
                    Continue Learning
                  </Button>
                ) : (
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? 'Enrolling...' : 'Enroll Now'}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Free course • No prerequisites required
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseDetail;
