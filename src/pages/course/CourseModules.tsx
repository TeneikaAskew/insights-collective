// ABOUTME: Course modules page displaying all modules in Canvas/Blackboard style interface
// ABOUTME: Shows organized course content by modules with progress tracking and navigation

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  FileText, 
  Video, 
  Download,
  ChevronRight,
  Clock,
  CheckCircle,
  PlayCircle
} from 'lucide-react';
import { useCourseData } from '@/hooks/useCourseData';
import { CourseLayout } from '@/components/course/CourseLayout';

export default function CourseModules() {
  const { courseId } = useParams();
  const { course, isLoading, error } = useCourseData(courseId);

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded"></div>
          ))}
        </div>
      </CourseLayout>
    );
  }

  if (error || !course) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || "Unable to load course modules."}
          </p>
          <Button asChild>
            <Link to={`/dashboard`}>Back to Dashboard</Link>
          </Button>
        </div>
      </CourseLayout>
    );
  }

  // Mock module data based on the course structure
  const modules = [
    {
      id: '1',
      title: 'Introduction to Machine Learning',
      week: 1,
      description: 'Fundamental concepts and overview of machine learning applications',
      progress: 100,
      status: 'completed',
      items: [
        { type: 'video', title: 'Welcome to Machine Learning', duration: '15 min', completed: true },
        { type: 'reading', title: 'ML Fundamentals Reading', duration: '30 min', completed: true },
        { type: 'assignment', title: 'ML Basics Quiz', duration: '20 min', completed: true, dueDate: '2024-01-10' }
      ]
    },
    {
      id: '2',
      title: 'Data Preprocessing and Feature Engineering',
      week: 2,
      description: 'Learn how to clean, transform and prepare data for machine learning models',
      progress: 75,
      status: 'in-progress',
      items: [
        { type: 'video', title: 'Data Cleaning Techniques', duration: '25 min', completed: true },
        { type: 'video', title: 'Feature Selection Methods', duration: '20 min', completed: true },
        { type: 'assignment', title: 'Data Preprocessing Assignment', duration: '60 min', completed: false, dueDate: '2024-01-17' },
        { type: 'reading', title: 'Feature Engineering Best Practices', duration: '45 min', completed: false }
      ]
    },
    {
      id: '3',
      title: 'Supervised Learning Algorithms',
      week: 3,
      description: 'Explore classification and regression algorithms',
      progress: 25,
      status: 'available',
      items: [
        { type: 'video', title: 'Linear Regression', duration: '30 min', completed: true },
        { type: 'video', title: 'Logistic Regression', duration: '25 min', completed: false },
        { type: 'video', title: 'Decision Trees', duration: '35 min', completed: false },
        { type: 'assignment', title: 'Classification Project', duration: '120 min', completed: false, dueDate: '2024-01-24' }
      ]
    },
    {
      id: '4',
      title: 'Model Evaluation and Validation',
      week: 4,
      description: 'Learn to evaluate model performance and avoid overfitting',
      progress: 0,
      status: 'locked',
      items: [
        { type: 'video', title: 'Cross-Validation Techniques', duration: '20 min', completed: false },
        { type: 'video', title: 'Performance Metrics', duration: '25 min', completed: false },
        { type: 'assignment', title: 'Model Evaluation Lab', duration: '90 min', completed: false, dueDate: '2024-01-31' }
      ]
    }
  ];

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'video': return <PlayCircle className="h-4 w-4 text-blue-500" />;
      case 'reading': return <BookOpen className="h-4 w-4 text-green-500" />;
      case 'assignment': return <FileText className="h-4 w-4 text-orange-500" />;
      case 'file': return <Download className="h-4 w-4 text-purple-500" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getModuleStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in-progress': return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'available': return <Badge variant="outline">Available</Badge>;
      case 'locked': return <Badge variant="secondary">Locked</Badge>;
      default: return null;
    }
  };

  return (
    <CourseLayout>
      <div className="space-y-6">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold mb-2">Course Modules</h1>
          <p className="text-muted-foreground">
            Complete modules in order to progress through the course
          </p>
        </div>

        <div className="space-y-6">
          {modules.map((module) => (
            <Card key={module.id} className={module.status === 'locked' ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      Week {module.week}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      <p className="text-muted-foreground mt-1">{module.description}</p>
                    </div>
                  </div>
                  {getModuleStatusBadge(module.status)}
                </div>
                
                {module.status !== 'locked' && (
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-muted-foreground">{module.progress}%</span>
                    </div>
                    <Progress value={module.progress} className="h-2" />
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {module.items.map((item, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                        module.status === 'locked' 
                          ? 'bg-muted/20' 
                          : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {getItemIcon(item.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{item.title}</h4>
                          {item.completed && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {item.duration}
                          </span>
                          {item.dueDate && (
                            <span>Due: {item.dueDate}</span>
                          )}
                          {item.type === 'assignment' && !item.completed && (
                            <Badge variant="outline" className="text-xs">Not Submitted</Badge>
                          )}
                        </div>
                      </div>
                      {module.status !== 'locked' && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>

                {module.status === 'locked' && (
                  <div className="mt-4 p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Complete previous modules to unlock this content
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CourseLayout>
  );
}