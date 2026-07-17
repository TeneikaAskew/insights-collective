import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { CourseLayout } from '@/components/course/CourseLayout';
import ModuleCard from '@/components/common/ModuleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BookOpen, Clock, Users, Star, Calendar, ChevronLeft, Share, MessageSquare, Edit, Bell, FileText, BarChart3, Pin, PlusCircle, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isEnrolledInCourse, addEnrolledCourse, isWishlistedCourse, toggleWishlistedCourse, generatePersistentUUID, isValidUUID } from '@/utils/idUtils';
import { Course } from '@/types';
import { useForums } from '@/hooks/useForums';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { EditCourseButton } from '@/components/course/EditCourseButton';
import { CourseModulesList } from '@/components/course/CourseModulesList';
import { CanvasAssignmentsList } from '@/components/course/canvas/CanvasAssignmentsList';
import { CourseContentPreview } from '@/components/course/CourseContentPreview';
import { LoginOverlayCard } from '@/components/course/LoginOverlayCard';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseDetail');

const CourseDetail = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const location = useLocation();
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

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const navigate = useNavigate();

  // Canonical progress — replaces the ad-hoc reduce over module.completionStatus.
  const { data: courseProgress } = useCourseProgress(courseId);

  // Determine current section from URL
  const currentSection = location.pathname.split('/').pop() || 'home';
  const isMainCourse = currentSection === courseId;
  
  // Always call useForums with courseId (which might be undefined)
  // The hook itself will handle the case when courseId is undefined
  const { forums, isLoadingForums } = useForums(courseId);
  const { canEdit, isAdmin, isInstructor } = useCoursePermissions(courseId);

  // Load announcements
  const fetchAnnouncements = async () => {
    if (!courseId) return;
    setAnnouncementsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('course_announcements')
        .select('id, title, content, is_pinned, created_at, created_by')
        .eq('course_id', courseId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (!err) setAnnouncements(data || []);
    } catch {
      // table may not exist yet; silently ignore
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    if (currentSection === 'announcements') void fetchAnnouncements();
  }, [courseId, currentSection]);

  const handleCreateAnnouncement = async () => {
    if (!courseId || !user?.id || !announcementTitle.trim()) return;
    setSubmittingAnnouncement(true);
    try {
      const { error: err } = await supabase
        .from('course_announcements')
        .insert({
          course_id: courseId,
          title: announcementTitle.trim(),
          content: announcementContent.trim() || null,
          is_pinned: announcementPinned,
          created_by: user.id,
        });
      if (err) throw err;
      toast({ title: 'Announcement posted' });
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementPinned(false);
      setShowAnnouncementForm(false);
      void fetchAnnouncements();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmittingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('course_announcements')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) {
        setError("No course ID provided");
        setLoading(false);
        return;
      }

      try {
        // Use courseId directly if it's a valid UUID, otherwise validate
        if (!isValidUUID(courseId)) {
          throw new Error("Invalid course ID format");
        }
        
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles!instructor_id(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('id', courseId)
          .single();

        if (courseError) throw courseError;
        if (!courseData) throw new Error("Course not found");

        // Fetch modules without embedding content_items. Embedding via PostgREST
        // relationship syntax is brittle when the schema cache is stale (e.g. after
        // dropping the legacy content_blocks table). We still treat a failed
        // modules fetch as a real error — modules are the primary payload for
        // this page — but content_items failures are non-fatal so the course
        // page renders with best-effort content metadata.
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('week', { ascending: true });

        if (modulesError) throw modulesError;

        const baseModules = modulesData || [];
        const moduleIds = baseModules.map((m: any) => m.id).filter(Boolean);

        let contentItemsByModule: Record<string, any[]> = {};
        if (moduleIds.length > 0) {
          const { data: contentItemsData, error: contentItemsError } = await supabase
            .from('content_items')
            .select('id, type, module_id')
            .in('module_id', moduleIds);

          if (contentItemsError) {
            logger.warn('Failed to load content items (continuing without them):', contentItemsError);
          } else {
            contentItemsByModule = (contentItemsData || []).reduce((acc: Record<string, any[]>, item: any) => {
              if (!item.module_id) return acc;
              if (!acc[item.module_id]) acc[item.module_id] = [];
              acc[item.module_id].push(item);
              return acc;
            }, {});
          }
        }

        // Process modules to include content item counts
        const processedModules = baseModules.map((module: any) => {
          const contentItems = contentItemsByModule[module.id] || [];
          const textBlocks = contentItems.filter(item =>
            ['page', 'discussion', 'external_url', 'external_tool'].includes(item.type)
          );
          const assignmentBlocks = contentItems.filter(item => item.type === 'assignment');
          const quizBlocks = contentItems.filter(item => item.type === 'quiz');

          return {
            ...module,
            lessons: textBlocks,
            assignments: assignmentBlocks,
            quizzes: quizBlocks,
            completionStatus: 0 // Will be updated with actual progress data later
          };
        });

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
          modules: processedModules,
          rating: 4.5,
          createdAt: courseData.created_at,
          updatedAt: courseData.updated_at,
          thumbnail: courseData.image_url || courseData.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
        };

        setCourse(formattedCourse);
        setModules(processedModules);
        setLoading(false);
      } catch (error: any) {
        logger.error('Error fetching course data:', error);
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
          if (!isValidUUID(courseId)) {
            logger.error(`Invalid course ID: ${courseId}`);
            return;
          }
          
          const { data, error } = await supabase
            .from('enrollments')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', courseId)
            .maybeSingle();
            
          if (!error && data) {
            setIsEnrolled(true);
          }
        } catch (error) {
          logger.error('Error checking enrollment:', error);
        }
      };

      const checkWishlist = async () => {
        try {
          if (!isValidUUID(courseId)) {
            logger.error(`Invalid course ID: ${courseId}`);
            return;
          }
          
          const { data, error } = await supabase
            .from('course_wishlists')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', courseId)
            .maybeSingle();
            
          if (!error && data) {
            setIsWishlisted(true);
          }
        } catch (error) {
          logger.error('Error checking wishlist:', error);
        }
      };
      
      checkEnrollment();
      checkWishlist();
    }
  }, [isAuthenticated, user, courseId]);

  if (loading) {
    return (
      <CourseLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </CourseLayout>
    );
  }

  if (error || !course) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "The course you're looking for doesn't exist or has been removed."}</p>
          <Button asChild>
            <Link to="/courses">Browse Courses</Link>
          </Button>
        </div>
      </CourseLayout>
    );
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
      if (!isValidUUID(courseId)) {
        throw new Error(`Invalid course ID format: ${courseId}`);
      }
      
      addEnrolledCourse(courseId);
      setIsEnrolled(true);

      if (isAuthenticated && user) {
        const { error } = await supabase.from('enrollments').insert({
          user_id: user.id,
          course_id: courseId,
          completion_status: 0
        });
        
        if (error) throw error;
      }
      
      toast({
        title: "Successfully enrolled!",
        description: `You have been enrolled in ${course.title}`
      });
    } catch (error: any) {
      logger.error('Error enrolling in course:', error);
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
      if (!isValidUUID(courseId)) {
        throw new Error(`Invalid course ID format: ${courseId}`);
      }
      
      const newWishlistStatus = toggleWishlistedCourse(courseId);
      setIsWishlisted(newWishlistStatus);

      if (isAuthenticated && user) {
        if (newWishlistStatus) {
          const { error } = await supabase.from('course_wishlists').insert({
            user_id: user.id,
            course_id: courseId
          });
          
          if (error) throw error;
        } else {
          const { error } = await supabase.from('course_wishlists').delete()
            .eq('user_id', user.id)
            .eq('course_id', courseId);
            
          if (error) throw error;
        }
      }
      
      toast({
        title: newWishlistStatus ? "Added to wishlist" : "Removed from wishlist",
        description: `${course.title} has been ${newWishlistStatus ? 'added to' : 'removed from'} your wishlist`
      });
    } catch (error: any) {
      logger.error('Error updating wishlist:', error);
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

  const overallProgress = courseProgress?.percent ?? 0;
  
  // Render different content based on the current section
  const renderContent = () => {
    switch (currentSection) {
      case 'modules':
        return <CourseModulesList courseId={courseId} />;
      
      case 'announcements':
        return (
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold">Announcements</h2>
                </div>
                {(canEdit || isInstructor || isAdmin) && (
                  <Button
                    size="sm"
                    onClick={() => setShowAnnouncementForm((v) => !v)}
                    variant={showAnnouncementForm ? 'secondary' : 'default'}
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    {showAnnouncementForm ? 'Cancel' : 'New Announcement'}
                  </Button>
                )}
              </div>

              {/* Create form */}
              {showAnnouncementForm && (
                <div className="border rounded-lg p-4 mb-6 bg-muted/10 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="ann-title">Title</Label>
                    <Input
                      id="ann-title"
                      placeholder="Announcement title"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ann-content">Message (optional)</Label>
                    <Textarea
                      id="ann-content"
                      placeholder="Write your announcement here..."
                      rows={4}
                      value={announcementContent}
                      onChange={(e) => setAnnouncementContent(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="ann-pinned"
                      type="checkbox"
                      checked={announcementPinned}
                      onChange={(e) => setAnnouncementPinned(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="ann-pinned" className="cursor-pointer">Pin this announcement</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAnnouncementForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateAnnouncement}
                      disabled={submittingAnnouncement || !announcementTitle.trim()}
                    >
                      {submittingAnnouncement ? 'Posting...' : 'Post'}
                    </Button>
                  </div>
                </div>
              )}

              {/* List */}
              {announcementsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading announcements…</div>
              ) : announcements.length === 0 ? (
                <div className="text-center p-8 border rounded-lg bg-muted/20">
                  <p className="text-muted-foreground">No announcements yet.</p>
                  {!(canEdit || isInstructor || isAdmin) && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Check back later for course updates and announcements.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="border rounded-lg p-4 bg-card relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {ann.is_pinned && (
                            <Pin className="h-4 w-4 text-primary shrink-0" />
                          )}
                          <h3 className="font-semibold truncate">{ann.title}</h3>
                        </div>
                        {(canEdit || isInstructor || isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {ann.content && (
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(ann.created_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      
      case 'assignments':
        return (
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Assignments</h2>
              </div>
              <CanvasAssignmentsList courseId={courseId!} />
            </div>
          </div>
        );
      
      case 'grades':
        return (
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Grades</h2>
              </div>
              <div className="text-center p-8 border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">No grades available yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Your grades will appear here once assignments are completed and graded.
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'calendar':
        return (
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Course Calendar</h2>
              </div>
              <div className="text-center p-8 border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">No calendar events yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Important dates and events will appear here.
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'people':
        return (
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">People</h2>
              </div>
              
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Instructor</h3>
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={course.instructor.avatar} />
                    <AvatarFallback>{course.instructor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{course.instructor.name}</p>
                    <p className="text-sm text-muted-foreground">Course Instructor</p>
                  </div>
                </div>
              </div>
              
              <div className="text-center p-8 border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">Student list not available.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Contact your instructor for more information about course participants.
                </p>
              </div>
            </div>
          </div>
        );
      
      default:
        // Home/Course Overview — Teachable-style enrollment landing
        return (
          <div className="teachable-workspace bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_360px] gap-0">
              {/* Left: hero + curriculum */}
              <div className="p-8 lg:p-12">
                <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-3">
                  {course.category || 'Course'}{course.level ? ` • ${course.level}` : ''}
                </p>
                <h1 className="tw-serif text-4xl md:text-5xl text-neutral-900 mb-4 leading-tight">
                  {course.title}
                </h1>
                <p className="text-neutral-700 text-lg leading-relaxed mb-6 max-w-2xl">
                  {course.description}
                </p>

                <div className="flex items-center gap-3 mb-8">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={course.instructor.avatar} />
                    <AvatarFallback>{course.instructor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{course.instructor.name}</p>
                    <p className="text-xs text-neutral-500">Instructor</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-600 mb-10 pb-8 border-b border-neutral-200">
                  {course.duration && (
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4" /> {course.duration}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> {modules.length} modules
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" /> {course.rating.toFixed(1)}
                  </span>
                </div>

                {/* Curriculum */}
                <div>
                  <h2 className="tw-serif text-2xl text-neutral-900 mb-5">Course curriculum</h2>
                  {modules.length === 0 ? (
                    <p className="text-sm text-neutral-500">Curriculum coming soon.</p>
                  ) : (
                    <div className="space-y-3">
                      {modules.map((m: any, idx: number) => {
                        const lessonCount =
                          (m.lessons?.length || 0) + (m.assignments?.length || 0) + (m.quizzes?.length || 0);
                        return (
                          <div key={m.id} className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-1">
                                  {m.week ? `Week ${m.week}` : `Section ${idx + 1}`}
                                </p>
                                <h3 className="font-semibold text-neutral-900 truncate">{m.title}</h3>
                              </div>
                              <span className="text-xs text-neutral-500 whitespace-nowrap ml-4">
                                {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: sticky enroll card */}
              <aside className="bg-neutral-50 border-t lg:border-t-0 lg:border-l border-neutral-200 p-8 lg:p-10">
                <div className="lg:sticky lg:top-6">
                  <div className="aspect-[16/9] rounded-xl overflow-hidden mb-6 bg-neutral-200">
                    <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                  </div>

                  {isEnrolled ? (
                    <>
                      <Button
                        asChild
                        className="w-full h-12 rounded-full bg-[#DAFB3C] hover:bg-[#c8ea28] text-neutral-900 font-semibold text-base shadow-none"
                      >
                        <Link to={`/courses/${courseId}/learn`}>Continue learning</Link>
                      </Button>
                      <div className="mt-5">
                        <div className="flex justify-between text-xs text-neutral-600 mb-2">
                          <span>Progress</span>
                          <span>{Math.round(overallProgress)}%</span>
                        </div>
                        <Progress value={overallProgress} className="h-1.5" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="w-full h-12 rounded-full bg-[#DAFB3C] hover:bg-[#c8ea28] text-neutral-900 font-semibold text-base shadow-none"
                      >
                        {enrolling ? 'Enrolling…' : 'Enroll for free'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleWishlist}
                        disabled={addingToWishlist}
                        className="w-full h-11 rounded-full mt-3 border-neutral-300"
                      >
                        {isWishlisted ? 'Saved to wishlist' : 'Save for later'}
                      </Button>
                    </>
                  )}

                  <div className="mt-8 space-y-3 text-sm text-neutral-700">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4 text-neutral-500" />
                      <span>{modules.length} modules</span>
                    </div>
                    {course.duration && (
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-neutral-500" />
                        <span>{course.duration}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-neutral-500" />
                      <span>{course.enrollmentCount || 0} enrolled</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        );
    }
  };
  
  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Course Header with Breadcrumb */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4 relative">
            <div className="flex-1 min-w-0 pr-4">
              <Breadcrumb className="mb-2 relative z-10">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={isAuthenticated ? "/enrolled-courses" : "/courses"}>Courses</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {currentSection !== courseId && currentSection !== 'home' ? (
                      <BreadcrumbLink asChild>
                        <Link to={`/courses/${courseId}`}>{course.title}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{course.title}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {currentSection !== courseId && currentSection !== 'home' && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="capitalize">{currentSection}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
              <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <span>{course.category}</span>
                <span>•</span>
                <span>{course.level}</span>
                <span>•</span>
                <span>{course.enrollmentCount || 0} students enrolled</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              <EditCourseButton courseId={courseId} />
            </div>
          </div>
          
          {/* Progress Bar for enrolled students */}
          {isEnrolled && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Course Progress</span>
                <span>{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </div>

        {renderContent()}
      </div>
    </CourseLayout>
  );
};

export default CourseDetail;
