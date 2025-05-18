import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Code2, 
  FileText, 
  Video, 
  BookOpen,
  TrendingUp,
  ArrowRight 
} from 'lucide-react';

interface Recommendation {
  id: string;
  title: string;
  type: 'code' | 'star' | 'mock' | 'study';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  link: string;
}

export function RecommendationEngine() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recommendations from the API
    const fetchRecommendations = async () => {
      try {
        const response = await fetch('/api/recommendations');
        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }
        const data = await response.json();
        setRecommendations(data);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'code':
        return <Code2 className="h-5 w-5" />;
      case 'star':
        return <FileText className="h-5 w-5" />;
      case 'mock':
        return <Video className="h-5 w-5" />;
      case 'study':
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'low':
        return 'bg-green-500/10 text-green-500';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p>Loading recommendations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recommended Practice</h2>
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>

      {recommendations.length === 0 ? (
        <Card>
          <CardContent className="flex h-[200px] items-center justify-center">
            <p className="text-muted-foreground">
              No recommendations available at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recommendations.map((recommendation) => (
            <Card key={recommendation.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(recommendation.type)}
                  <CardTitle className="text-base font-medium">
                    {recommendation.title}
                  </CardTitle>
                </div>
                <Badge className={getPriorityColor(recommendation.priority)}>
                  {recommendation.priority} priority
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  {recommendation.reason}
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to={recommendation.link}>
                    Start Practice
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 