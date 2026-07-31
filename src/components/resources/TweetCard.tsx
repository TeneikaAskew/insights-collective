
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Twitter, Heart, Repeat } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Tweet {
  id: string;
  content: string;
  date: string;
  url: string;
  likes: number;
  retweets: number;
}

interface TweetCardProps {
  tweet: Tweet;
  highlighted?: boolean;
}

export const TweetCard = ({ tweet, highlighted = false }: TweetCardProps) => {
  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  const formatMetric = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const backgroundClass = highlighted
    ? 'bg-white shadow-md border-2 border-blue-200 '
    : 'bg-white shadow-sm';

  return (
    <Card className={`hover:shadow-md transition-shadow overflow-hidden ${backgroundClass}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700">
              <Twitter className="h-5 w-5" />
            </div>
          </div>
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="font-semibold text-gray-900">Top Tweet</span>
                {tweet.date && (
                  <>
                    <span className="text-gray-500 mx-2">·</span>
                    <span className="text-gray-500 text-sm">{formatTimeAgo(tweet.date)}</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-gray-800 mb-3">{tweet.content}</p>
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-6 text-gray-500">
                <div className="flex items-center">
                  <Heart className="h-4 w-4 mr-1 text-red-500" />
                  <span className="text-sm">{formatMetric(tweet.likes)}</span>
                </div>
                <div className="flex items-center">
                  <Repeat className="h-4 w-4 mr-1 text-green-500" />
                  <span className="text-sm">{formatMetric(tweet.retweets)}</span>
                </div>
              </div>
            </div>
            
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                <span>View on X</span>
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
