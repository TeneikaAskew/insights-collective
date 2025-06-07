
import { useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { MessageSquare, Users, Clock, ChevronLeft } from 'lucide-react';

const Forums = () => {
  const { courseId } = useParams<{ courseId: string }>();

  // Mock forums data - in a real app, this would come from an API
  const forums = [
    {
      id: '1',
      title: 'General Discussion',
      description: 'General course discussion and questions',
      threadCount: 25,
      lastActivity: '2 hours ago'
    },
    {
      id: '2',
      title: 'Assignment Help',
      description: 'Get help with course assignments',
      threadCount: 18,
      lastActivity: '5 hours ago'
    },
    {
      id: '3',
      title: 'Project Showcase',
      description: 'Share your projects and get feedback',
      threadCount: 12,
      lastActivity: '1 day ago'
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Course
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">Course Forums</h1>
          <p className="text-muted-foreground">
            Engage in discussions with fellow students and instructors.
          </p>
        </div>

        <div className="grid gap-4">
          {forums.map((forum) => (
            <Link key={forum.id} to={`/courses/${courseId}/forums/${forum.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    {forum.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{forum.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{forum.threadCount} threads</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Last activity {forum.lastActivity}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Forums;
