
import { Card, CardContent } from '@/components/ui/card';
import { Twitter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Tweet {
  id: string;
  content: string;
  date: string;
  likes: number;
  retweets: number;
}

interface TweetCardProps {
  tweet: Tweet;
}

export const TweetCard = ({ tweet }: TweetCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
              <Twitter className="h-5 w-5" />
            </div>
          </div>
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="font-semibold text-gray-900">IC Academy</span>
                <span className="text-gray-500 mx-2">·</span>
                <span className="text-gray-500 text-sm">{formatDate(tweet.date)}</span>
              </div>
              <Badge variant="secondary" className="text-xs">Data Science</Badge>
            </div>
            <p className="text-gray-800 mb-3">{tweet.content}</p>
            <div className="flex items-center text-gray-500 text-sm space-x-4">
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>{tweet.likes}</span>
              </div>
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{tweet.retweets}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
