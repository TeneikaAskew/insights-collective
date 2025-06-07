
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Clock, ChevronLeft, Plus } from 'lucide-react';

const ForumDetail = () => {
  const { courseId, forumId } = useParams<{ courseId: string; forumId: string }>();

  // Mock forum and threads data
  const forum = {
    id: forumId,
    title: 'General Discussion',
    description: 'General course discussion and questions'
  };

  const threads = [
    {
      id: '1',
      title: 'Welcome to the course!',
      author: 'John Doe',
      replies: 15,
      lastActivity: '2 hours ago',
      isPinned: true
    },
    {
      id: '2', 
      title: 'Question about Module 1',
      author: 'Jane Smith',
      replies: 8,
      lastActivity: '5 hours ago',
      isPinned: false
    },
    {
      id: '3',
      title: 'Study group forming',
      author: 'Mike Johnson',
      replies: 23,
      lastActivity: '1 day ago',
      isPinned: false
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}/forums`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Forums
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{forum.title}</h1>
            <p className="text-muted-foreground">{forum.description}</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Button>
        </div>

        <div className="space-y-4">
          {threads.map((thread) => (
            <Link key={thread.id} to={`/courses/${courseId}/forums/${forumId}/threads/${thread.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{thread.title}</h3>
                        {thread.isPinned && (
                          <Badge variant="secondary">Pinned</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Started by {thread.author}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{thread.replies} replies</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Last activity {thread.lastActivity}</span>
                        </div>
                      </div>
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

export default ForumDetail;
