import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ModuleCard from '@/components/common/ModuleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BookOpen, Clock, Users, Star, Calendar, GraduationCap, ChevronLeft, Share, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isEnrolledInCourse, addEnrolledCourse, isWishlistedCourse, toggleWishlistedCourse, generatePersistentUUID, isValidUUID } from '@/utils/idUtils';
import { Course } from '@/types';
import { useForums } from '@/hooks/useForums';

const CourseDetail = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [enrolling, setEnrolling] = useState(false);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) {
        setError("No course ID provided");
        setLoading(false);
        return;
      }

      try {
        const courseUUID = generatePersistentUUID(courseId, 'course');
        if (!isValidUUID(courseUUID)) {
          throw new Error("Invalid course ID format");
        }
        
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:instructor_id(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('id', courseUUID)
          .single();

        if (courseError) throw courseError;
        if (!courseData) throw new Error("Course not found");

        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseUUID)
          .order('week', { ascending: true });

        if (modulesError) throw modulesError;

        const formattedCourse = {
          ...courseData,
          instructor: {
            id: courseData.instructor?.id || '',
            name: `${courseData.instructor?.first_name || ''} ${courseData.instructor?.last_name || ''}`.trim(),
            email: '',
            role: 'instructor',
            avatar: courseData.instructor?.avatar_url || '',
          },
          enrollmentCount: 0,
          modules: modulesData || [],
          rating: 4.5,
          createdAt: courseData.created_at,
          updatedAt: courseData.updated_at,
          thumbnail: courseData.image_url || courseData.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
        };

        setCourse(formattedCourse);
        setModules(modulesData || []);
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching course data:', error);
        setError(error.message || "Error loading course");
        setLoading(false);
        toast({
          title: "Failed to load course",
          description: error.message || "There was an error loading the course data",
          variant: "destructive"
        });
      }
    };

    fetchCourseData();
  }, [courseId, toast]);

  useEffect(() => {
    if (!courseId) return;
    
    setIsEnrolled(isEnrolledInCourse(courseId));
    setIsWishlisted(isWishlistedCourse(courseId));

    if (isAuthenticated && user && courseId) {
      const checkEnrollment = async () => {
        try {
          const courseUUID = generatePersistentUUID(courseId, 'course');
          if (!isValidUUID(courseUUID)) {
            console.error(`Invalid course UUID: ${courseUUID} for course ID: ${courseId}`);
            return;
          }
          
          const { data, error } = await supabase
            .from('enrollments')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', courseUUID)
            .maybeSingle();
            
          if (!error && data) {
            setIsEnrolled(true);
          }
        } catch (error) {
          console.error('Error checking enrollment:', error);
        }
      };

      const checkWishlist = async () => {
        try {
          const courseUUID = generatePersistentUUID(courseId, 'course');
          if (!isValidUUID(courseUUID)) {
            console.error(`Invalid course UUID: ${courseUUID} for course ID: ${courseId}`);
            return;
          }
          
          const { data, error } = await supabase
            .from('course_wishlists')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', courseUUID)
            .maybeSingle();
            
          if (!error && data) {
            setIsWishlisted(true);
          }
        } catch (error) {
          console.error('Error checking wishlist:', error);
        }
      };
      
      checkEnrollment();
      checkWishlist();
    }
  }, [isAuthenticated, user, courseId]);

  if (loading) {
    return <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>;
  }

  if (error || !course) {
    return <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "The course you're looking for doesn't exist or has been removed."}</p>
          <Button asChild>
            <Link to="/courses">Browse Courses</Link>
          </Button>
        </div>
      </AppLayout>;
  }

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', `/courses/${courseId}`);
      navigate('/login', {
        state: {
          from: `/courses/${courseId}`
        }
      });
      return;
    }
    
    if (!courseId) return;
    setEnrolling(true);
    
    try {
      const courseUUID = generatePersistentUUID(courseId, 'course');
      if (!isValidUUID(courseUUID)) {
        throw new Error(`Invalid course UUID format for course ID: ${courseId}`);
      }
      
      addEnrolledCourse(courseId);
      setIsEnrolled(true);

      if (isAuthenticated && user) {
        const { error } = await supabase.from('enrollments').insert({
          user_id: user.id,
          course_id: courseUUID,
          completion_status: 0
        });
        
        if (error) throw error;
      }
      
      toast({
        title: "Successfully enrolled!",
        description: `You have been enrolled in ${course.title}`
      });
    } catch (error: any) {
      console.error('Error enrolling in course:', error);
      toast({
        title: "Enrollment failed",
        description: error.message || "There was an error enrolling in this course",
        variant: "destructive"
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', `/courses/${courseId}`);
      navigate('/login', {
        state: {
          from: `/courses/${courseId}`
        }
      });
      return;
    }
    
    if (!courseId) return;
    setAddingToWishlist(true);
    
    try {
      const courseUUID = generatePersistentUUID(courseId, 'course');
      if (!isValidUUID(courseUUID)) {
        throw new Error(`Invalid course UUID format for course ID: ${courseId}`);
      }
      
      const newWishlistStatus = toggleWishlistedCourse(courseId);
      setIsWishlisted(newWishlistStatus);

      if (isAuthenticated && user) {
        if (newWishlistStatus) {
          const { error } = await supabase.from('course_wishlists').insert({
            user_id: user.id,
            course_id: courseUUID
          });
          
          if (error) throw error;
        } else {
          const { error } = await supabase.from('course_wishlists').delete()
            .eq('user_id', user.id)
            .eq('course_id', courseUUID);
            
          if (error) throw error;
        }
      }
      
      toast({
        title: newWishlistStatus ? "Added to wishlist" : "Removed from wishlist",
        description: `${course.title} has been ${newWishlistStatus ? 'added to' : 'removed from'} your wishlist`
      });
    } catch (error: any) {
      console.error('Error updating wishlist:', error);
      toast({
        title: "Wishlist update failed",
        description: error.message || "There was an error updating your wishlist",
        variant: "destructive"
      });

      setIsWishlisted(!isWishlisted);
    } finally {
      setAddingToWishlist(false);
    }
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = `Check out this course: ${course.title}`;
    
    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        navigator.clipboard.writeText(url).then(() => {
          toast({
            title: "Link copied",
            description: "Course link copied to clipboard for sharing"
          });
        });
        break;
      default:
        navigator.clipboard.writeText(url).then(() => {
          toast({
            title: "Link copied",
            description: "Course link copied to clipboard for sharing"
          });
        });
    }
  };

  const overallProgress = course.modules.reduce((sum, module) => sum + (module.completionStatus || 0), 0) / (course.modules.length || 1);
  
  const { forums, isLoadingForums } = useForums(courseId);
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to="/courses">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Courses
            </Link>
          </Button>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="aspect-video w-full overflow-hidden">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge>{course.category}</Badge>
                  <Badge variant="outline">{course.level}</Badge>
                  <Badge variant={course.enrollmentStatus === 'Open' ? 'secondary' : course.enrollmentStatus === 'In Progress' ? 'default' : 'outline'}>
                    {course.enrollmentStatus}
                  </Badge>
                </div>
                
                <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{course.enrollmentCount} students</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 text-yellow-500" />
                    <span>{course.rating.toFixed(1)} rating</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>Last updated {new Date(course.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mb-6">
                  <Avatar>
                    <AvatarImage src={course.instructor.avatar} />
                    <AvatarFallback>{course.instructor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{course.instructor.name}</p>
                    <p className="text-sm text-muted-foreground">Instructor</p>
                  </div>
                </div>
                
                <p className="text-lg mb-6">{course.description}</p>
                
                <div className="flex flex-wrap gap-3">
                  {course.tags && course.tags.map(tag => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Tabs defaultValue="modules">
              <TabsList>
                <TabsTrigger value="modules">Modules</TabsTrigger>
                <TabsTrigger value="forums">Forums</TabsTrigger>
                <TabsTrigger value="overview">Course Overview</TabsTrigger>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="discussions">Discussions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="modules" className="space-y-6 mt-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Course Modules</h2>
                  <p className="text-muted-foreground mb-6">
                    This course contains {modules.length} modules organized by week.
                  </p>
                  
                  {modules.length > 0 ? (
                    <div className="space-y-4">
                      {modules.map(module => (
                        <ModuleCard key={module.id} courseId={course.id} module={module} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 border rounded-lg bg-muted/20">
                      <p>No modules available for this course yet.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="forums" className="space-y-6 mt-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Course Forums</h2>
                      <p className="text-muted-foreground">
                        Engage in discussions with fellow students and instructors.
                      </p>
                    </div>
                    <Button asChild>
                      <Link to={`/courses/${courseId}/forums`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View All Forums
                      </Link>
                    </Button>
                  </div>
                  
                  {isLoadingForums ? (
                    <div className="space-y-4">
                      <Card className="p-8">
                        <div className="animate-pulse flex space-x-4">
                          <div className="flex-1 space-y-4 py-1">
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                            <div className="h-4 bg-muted rounded"></div>
                            <div className="h-4 bg-muted rounded w-5/6"></div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ) : forums && forums.length > 0 ? (
                    <div className="space-y-4">
                      {forums.slice(0, 3).map(forum => (
                        <Link key={forum.id} to={`/courses/${courseId}/forums/${forum.id}`}>
                          <Card className="hover:bg-muted/50 transition-colors">
                            <CardContent className="p-4">
                              <h3 className="text-lg font-semibold mb-1">{forum.title}</h3>
                              <p className="text-muted-foreground text-sm mb-2">{forum.description}</p>
                              <div className="flex justify-end">
                                <Button variant="outline" size="sm">
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Browse Threads
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                      {forums.length > 3 && (
                        <div className="text-center mt-2">
                          <Button variant="link" asChild>
                            <Link to={`/courses/${courseId}/forums`}>
                              View All {forums.length} Forums
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-8 border rounded-lg bg-muted/20">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Forums Yet</h3>
                      <p className="text-muted-foreground">Forums for this course will appear here once they're available.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="overview" className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4">Course Overview</h2>
                    
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">What You'll Learn</h3>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Understand core concepts in {course.category}</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Build real-world projects using industry best practices</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Master {course.tags?.join(", ") || "key techniques"}</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Develop problem-solving skills through hands-on exercises</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Prerequisites</h3>
                        <p>Basic understanding of computing concepts. No prior experience in {course.category} is required for this {course.level.toLowerCase()} level course.</p>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Course Structure</h3>
                        <p>This course is structured in {modules.length} weekly modules, each containing video lessons, reading materials, quizzes, and assignments to reinforce your learning.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="materials" className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold mb-4">Course Materials</h2>
                    <p className="text-muted-foreground mb-6">
                      Access course resources, textbooks, and supplementary materials.
                    </p>
                    
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Required Materials</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-amber-600 dark:text-amber-400" />
                            <span>Main course textbook (provided as PDF)</span>
                          </li>
                          <li className="flex items-center p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-amber-600 dark:text-amber-400" />
                            <span>Exercise workbook</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Recommended Resources</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-400" />
                            <span>Supplementary reading materials</span>
                          </li>
                          <li className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-400" />
                            <span>Community forum resources</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="discussions" className="mt-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Course Discussions</h2>
                    <p className="text-muted-foreground mb-6">
                      Enroll in the course to join discussions with instructors and other students.
                    </p>
                    <Button onClick={handleEnroll} disabled={isEnrolled || enrolling}>
                      {enrolling ? "Enrolling..." : isEnrolled ? "Already Enrolled" : "Enroll Now"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-xl font-bold">Course Progress</h2>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>{Math.round(overallProgress)}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button size="lg" onClick={handleEnroll} disabled={enrolling || isEnrolled}>
                    {enrolling ? "Enrolling..." : isEnrolled ? "Already Enrolled" : "Enroll in Course"}
                  </Button>
                  
                  <Button variant="outline" size="lg" onClick={handleWishlist} disabled={addingToWishlist}>
                    {addingToWishlist ? "Updating..." : isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  </Button>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">This Course Includes:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                      <span>{modules.length > 0 ? modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) : 0} lessons</span>
                    </li>
                    <li className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                      <span>{course.duration} of content</span>
                    </li>
                    <li className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                      <span>Access to student community</span>
                    </li>
                    <li className="flex items-center">
                      <Star className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
                      <span>Course completion certificate</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Share This Course:</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleShare('facebook')}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleShare('twitter')}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleShare('linkedin')}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect x="2" y="9" width="4" height="12"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleShare('instagram')}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleShare('copy')}>
                      <Share className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseDetail;
