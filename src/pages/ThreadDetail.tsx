
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, MessageSquare } from 'lucide-react';

const ThreadDetail = () => {
  const { courseId, forumId, threadId } = useParams<{ 
    courseId: string; 
    forumId: string; 
    threadId: string; 
  }>();

  // Mock thread and posts data
  const thread = {
    id: threadId,
    title: 'Welcome to the course!',
    author: 'John Doe',
    created: '2 days ago'
  };

  const posts = [
    {
      id: '1',
      content: 'Welcome everyone! I\'m excited to start this journey with you all. Feel free to introduce yourselves and share what you hope to learn from this course.',
      author: 'John Doe',
      avatar: '/api/placeholder/32/32',
      timestamp: '2 days ago',
      isOriginalPost: true
    },
    {
      id: '2',
      content: 'Hi everyone! I\'m Jane and I\'m looking forward to learning React. I have some experience with JavaScript but this is my first time with React.',
      author: 'Jane Smith',
      avatar: '/api/placeholder/32/32',
      timestamp: '1 day ago',
      isOriginalPost: false
    },
    {
      id: '3',
      content: 'Hello! I\'m Mike, a backend developer trying to expand into frontend. Excited to learn!',
      author: 'Mike Johnson',
      avatar: '/api/placeholder/32/32',
      timestamp: '5 hours ago',
      isOriginalPost: false
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}/forums/${forumId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Forum
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">{thread.title}</h1>
          <p className="text-muted-foreground">
            Started by {thread.author} • {thread.created}
          </p>
        </div>

        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={post.avatar} />
                    <AvatarFallback>{post.author.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{post.author}</p>
                    <p className="text-sm text-muted-foreground">{post.timestamp}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{post.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Reply to this thread
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="Write your reply..."
              className="min-h-[100px]"
            />
            <Button>Post Reply</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ThreadDetail;
