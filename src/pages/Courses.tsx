
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, Users, Star, Play } from 'lucide-react';

const Courses = () => {
  // Initialize page onboarding
  usePageOnboarding({ 
    tourId: 'courses', 
    autoStart: true,
    dependencies: ['portfolio-explorer'] // Start after portfolio explorer tour
  });

  const featuredCourses = [
    {
      id: 1,
      title: "Python for Data Science",
      instructor: "Dr. Sarah Chen",
      duration: "8 weeks",
      students: 1247,
      rating: 4.8,
      difficulty: "Beginner",
      thumbnail: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&h=200&fit=crop"
    },
    {
      id: 2,
      title: "Machine Learning Fundamentals",
      instructor: "Prof. Michael Rodriguez",
      duration: "10 weeks",
      students: 892,
      rating: 4.9,
      difficulty: "Intermediate",
      thumbnail: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&h=200&fit=crop"
    },
    {
      id: 3,
      title: "SQL for Data Analysis",
      instructor: "Lisa Wang",
      duration: "6 weeks",
      students: 2156,
      rating: 4.7,
      difficulty: "Beginner",
      thumbnail: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=200&fit=crop"
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Courses"
          description="Master data skills with expert-led courses designed for your career goals."
          pageTourId="courses"
        />
        
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="mb-6" data-tour="course-catalog">
              <h2 className="text-2xl font-bold mb-4">Featured Courses</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredCourses.map((course) => (
                  <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-video overflow-hidden">
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                        <Badge variant={course.difficulty === 'Beginner' ? 'default' : 'secondary'}>
                          {course.difficulty}
                        </Badge>
                      </div>
                      <CardDescription>
                        by {course.instructor}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {course.duration}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {course.students.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {course.rating}
                        </div>
                      </div>
                      <Button className="w-full">
                        <Play className="h-4 w-4 mr-2" />
                        Start Course
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div data-tour="learning-features">
              <h2 className="text-2xl font-bold mb-4">Learning Paths</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Data Science Fundamentals</h3>
                  <p className="text-gray-600 mb-4">Complete beginner path covering Python, statistics, and machine learning basics.</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">5 courses • 24 weeks</span>
                    <Button variant="outline">Explore Path</Button>
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
                  <p className="text-gray-600 mb-4">Deep dive into advanced machine learning, deep learning, and AI techniques.</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">7 courses • 32 weeks</span>
                    <Button variant="outline">Explore Path</Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Progress</CardTitle>
                <CardDescription>Track your learning journey</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p>No courses enrolled yet</p>
                  <p className="text-sm">Start learning to see your progress here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Skills</CardTitle>
                <CardDescription>Most in-demand data skills</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Python</span>
                  <Badge variant="outline">Essential</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>SQL</span>
                  <Badge variant="outline">Essential</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Machine Learning</span>
                  <Badge variant="outline">High Demand</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Data Visualization</span>
                  <Badge variant="outline">Growing</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Courses;
