
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink } from 'lucide-react';
import { Resource } from '@/hooks/useResources';

interface ResourceCardProps {
  resource: Resource & {
    sourceType?: 'Tweet' | 'LinkedIn' | 'Standard';
    resourceType?: string;
    careerCategory?: string;
  };
}

export const ResourceCard = ({ resource }: ResourceCardProps) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get the link, prioritizing different fields based on availability
  const getResourceLink = () => {
    return resource.resource_link || resource.tweet_url || resource.linkedin_url || '#';
  };

  // Get resource title or type information
  const getResourceTitle = () => {
    return resource.resourceType || resource.category || 'Resource';
  };

  // Get resource description
  const getResourceDescription = () => {
    return resource.full_text || resource.careerCategory || '';
  };

  // Get category badge text
  const getResourceCategory = () => {
    return resource.careerCategory || resource.category || 'General';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{getResourceTitle()}</CardTitle>
            <CardDescription className="mt-2">{getResourceDescription()}</CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">
            {getResourceCategory()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {resource.deadline && (
          <div className="flex items-center text-sm text-muted-foreground mb-4">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Deadline: {formatDate(resource.deadline)}</span>
          </div>
        )}
        {resource.created_at && !resource.deadline && (
          <div className="flex items-center text-sm text-muted-foreground mb-4">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Posted: {formatDate(resource.created_at)}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" asChild>
          <a href={getResourceLink()} target="_blank" rel="noopener noreferrer" className="flex items-center">
            Visit Resource
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
};
