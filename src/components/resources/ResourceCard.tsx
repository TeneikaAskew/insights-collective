
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink } from 'lucide-react';
import { Resource, parseArrayField, normalizeString } from '@/hooks/useResources';

interface ResourceCardProps {
  resource: Resource & {
    sourceType?: 'Tweet' | 'LinkedIn' | 'Standard'; // sourceType is optional as it's added post-fetch
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

  const getResourceCategories = (): string[] => {
    const categories = new Set<string>();
    if (resource.career_area) parseArrayField(resource.career_area).forEach(label => categories.add(normalizeString(label)));
    if (resource.predicted_career_labels) parseArrayField(resource.predicted_career_labels).forEach(label => categories.add(normalizeString(label)));
    if (resource.category && resource.category.toLowerCase() !== 'general') parseArrayField(resource.category).forEach(label => categories.add(normalizeString(label)));
    if (categories.size === 0 && resource.sourceType === 'Standard') categories.add('General');
    else if (categories.size === 0) categories.add('General'); // Fallback for non-Standard or if sourceType is undefined
    return Array.from(categories);
  };

  const getResourceTypes = (): string[] => {
    const types = new Set<string>();
    if (resource.resource_type) parseArrayField(resource.resource_type).forEach(label => types.add(normalizeString(label)));
    if (resource.predicted_resource_labels) parseArrayField(resource.predicted_resource_labels).forEach(label => types.add(normalizeString(label)));
    if (types.size === 0 && resource.sourceType === 'Standard') types.add('Resource');
    else if (types.size === 0) types.add('Resource'); // Fallback
    return Array.from(types);
  };

  const getResourceLink = () => {
    if (!resource.resource_link && resource.source?.toLowerCase().includes('twitter') && resource.tweet_id) {
      return `https://x.com/teneikaask_you/status/${resource.tweet_id}`;
    }
    return resource.resource_link || '#';
  };
  
  const getButtonText = () => {
    if (resource.source?.toLowerCase().includes('twitter')) return 'Visit Tweet';
    if (resource.source?.toLowerCase().includes('linkedin')) return 'Visit LinkedIn Post';
    return 'Visit Resource';
  };

  const resourceCategories = getResourceCategories();
  const resourceTypes = getResourceTypes();

  // getResourceTitle is removed as CardTitle is removed. Description will serve as main text.
  // const getResourceTitle = () => { ... } 

  const getResourceDescription = () => {
    return resource.full_text || 'No description available.';
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        {/* Display Categories at the top */}
        {resourceCategories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 w-full">
            {resourceCategories.map((category, index) => (
              <Badge key={`cat-${index}`} variant="outline" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        )}

        {/* Display Types (previously next to title, now below categories) */}
        {resourceTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 justify-start">
            {resourceTypes.map((type, index) => (
              <Badge key={`type-${index}`} variant="secondary" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        )}
        
        {/* CardTitle (H3) removed as per request */}
        {/* <CardTitle>...</CardTitle> */}

        <CardDescription className="text-sm text-gray-600 mt-1 leading-relaxed flex-grow">
          {getResourceDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0"> {/* Adjusted pt-0 as content might be sparse now */}
        {resource.deadline && (
          <div className="flex items-center text-xs text-muted-foreground mt-2 mb-2"> {/* Added mt-2 for spacing */}
            <Calendar className="h-3 w-3 mr-1.5" />
            <span>Deadline: {formatDate(resource.deadline)}</span>
          </div>
        )}
        {resource.created_at && !resource.deadline && (
          <div className="flex items-center text-xs text-muted-foreground mt-2 mb-2"> {/* Added mt-2 for spacing */}
            <Calendar className="h-3 w-3 mr-1.5" />
            <span>Posted: {formatDate(resource.created_at)}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start pt-4"> {/* Ensured some padding top if content is minimal */}
        <Button variant="outline" size="sm" asChild className="w-full">
          <a href={getResourceLink()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
            {getButtonText()}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        {/* Category badges were moved from here to CardHeader */}
      </CardFooter>
    </Card>
  );
};
