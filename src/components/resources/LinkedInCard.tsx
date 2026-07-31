
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Linkedin, ExternalLink, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LinkedInPost {
  id: string;
  title: string;
  description: string;
  date: string;
  url: string;
}

interface LinkedInCardProps {
  post: LinkedInPost;
}

export const LinkedInCard = ({ post }: LinkedInCardProps) => {
  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-ss-teal-chip rounded-full flex items-center justify-center text-ss-teal">
              <Linkedin className="h-5 w-5" />
            </div>
          </div>
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="font-semibold text-foreground">IC Academy</span>
                {post.date && (
                  <>
                    <span className="text-muted-foreground mx-2">·</span>
                    <span className="text-muted-foreground text-sm">{formatTimeAgo(post.date)}</span>
                  </>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">{post.title}</Badge>
            </div>
            <p className="text-foreground mb-3">{post.description}</p>
            
            <div className="flex items-center space-x-2 mb-3">
              {post.date && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>{new Date(post.date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                <Linkedin className="h-4 w-4 mr-2" />
                View on LinkedIn
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
