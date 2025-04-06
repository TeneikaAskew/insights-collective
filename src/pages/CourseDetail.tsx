
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ModuleCard from '@/components/common/ModuleCard';
import { mockService } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BookOpen, Clock, Users, Star, Calendar, GraduationCap, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CourseDetail = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [enrolling, setEnrolling] = useState(false);
  const { toast } = useToast();
  
  // Get course details
  const course = mockService.getCourseById(courseId || '');
  
  if (!course) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">The course you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link to="/courses">Browse Courses</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  // Mock enrollment function
  const handleEnroll = () => {
    setEnrolling(true);
    
    // Simulate API call
    setTimeout(() => {
      setEnrolling(false);
      toast({
        title: "Successfully enrolled!",
        description: `You have been enrolled in ${course.title}`,
      });
    }, 1000);
  };
  
  // Calculate overall progress (would come from the database in a real app)
  const overallProgress = course.modules.reduce(
    (sum, module) => sum + module.completionStatus, 
    0
  ) / (course.modules.length || 1);
  
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
                <img 
                  src={course.thumbnail} 
                  alt={course.title} 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge>{course.category}</Badge>
                  <Badge variant="outline">{course.level}</Badge>
                  <Badge variant={
                    course.enrollmentStatus === 'Open' ? 'secondary' :
                    course.enrollmentStatus === 'In Progress' ? 'default' : 'outline'
                  }>
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
                  {course.tags.map((tag) => (
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
                <TabsTrigger value="overview">Course Overview</TabsTrigger>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="discussions">Discussions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="modules" className="space-y-6 mt-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Course Modules</h2>
                  <p className="text-muted-foreground mb-6">
                    This course contains {course.modules.length} modules organized by week.
                  </p>
                  
                  <div className="space-y-4">
                    {course.modules.map((module) => (
                      <ModuleCard key={module.id} courseId={course.id} module={module} />
                    ))}
                  </div>
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
                            <span>Master {course.tags.join(", ")} techniques</span>
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
                        <p>This course is structured in {course.modules.length} weekly modules, each containing video lessons, reading materials, quizzes, and assignments to reinforce your learning.</p>
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
                          <li className="flex items-center p-3 bg-secondary rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-primary" />
                            <span>Main course textbook (provided as PDF)</span>
                          </li>
                          <li className="flex items-center p-3 bg-secondary rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-primary" />
                            <span>Exercise workbook</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Recommended Resources</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center p-3 bg-secondary rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-primary" />
                            <span>Supplementary reading materials</span>
                          </li>
                          <li className="flex items-center p-3 bg-secondary rounded-lg">
                            <BookOpen className="h-5 w-5 mr-3 text-primary" />
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
                    <Button>Enroll Now</Button>
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
                  <Button size="lg" onClick={handleEnroll} disabled={enrolling}>
                    {enrolling ? "Enrolling..." : "Enroll in Course"}
                  </Button>
                  
                  <Button variant="outline" size="lg">
                    Add to Wishlist
                  </Button>
                </div>
                
                <div className="bg-secondary p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">This Course Includes:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center">
                      <BookOpen className="h-4 w-4 mr-2 text-primary" />
                      <span>{course.modules.reduce((sum, m) => sum + m.lessons.length, 0)} lessons</span>
                    </li>
                    <li className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-primary" />
                      <span>{course.duration} of content</span>
                    </li>
                    <li className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-primary" />
                      <span>Access to student community</span>
                    </li>
                    <li className="flex items-center">
                      <Star className="h-4 w-4 mr-2 text-primary" />
                      <span>Course completion certificate</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Share This Course:</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect x="2" y="9" width="4" height="12"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
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
