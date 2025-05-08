
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink } from 'lucide-react';
import { Resource, parseArrayField, normalizeString } from '@/hooks/useResources';

interface ResourceCardProps {
  resource: Resource & {
    sourceType?: 'Tweet' | 'LinkedIn' | 'Standard';
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

  // Parse and combine category fields
  const getResourceCategories = (): string[] => {
    const categories = new Set<string>();
    
    if (resource.career_area) {
      parseArrayField(resource.career_area).forEach(label => categories.add(normalizeString(label)));
    }
    if (resource.predicted_career_labels) {
      parseArrayField(resource.predicted_career_labels).forEach(label => categories.add(normalizeString(label)));
    }
    if (resource.category && resource.category.toLowerCase() !== 'general') {
      parseArrayField(resource.category).forEach(label => categories.add(normalizeString(label)));
    }
    
    if (categories.size === 0) {
      categories.add('General');
    }
    
    return Array.from(categories);
  };

  // Parse and combine resource type fields
  const getResourceTypes = (): string[] => {
    const types = new Set<string>();
    
    if (resource.resource_type) {
      parseArrayField(resource.resource_type).forEach(label => types.add(normalizeString(label)));
    }
    if (resource.predicted_resource_labels) {
      parseArrayField(resource.predicted_resource_labels).forEach(label => types.add(normalizeString(label)));
    }
    
    if (types.size === 0) {
      types.add('Resource');
    }
    
    return Array.from(types);
  };

  const getResourceLink = () => {
    return resource.resource_link || '#';
  };

  const resourceCategories = getResourceCategories();
  const resourceTypes = getResourceTypes();

  const getResourceTitle = () => {
    if (resourceTypes.length > 0 && resourceTypes[0] !== 'Resource') {
      return resourceTypes[0]; 
    }
    if (resource.full_text) {
        const words = resource.full_text.split(' ');
        if (words.length > 10) {
            return words.slice(0, 10).join(' ') + '...';
        }
        return resource.full_text;
    }
    return 'Resource Details';
  };

  const getResourceDescription = () => {
    return resource.full_text || 'No description available.';
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <CardTitle className="text-lg font-semibold mr-2 break-words flex-grow">
            {getResourceTitle()}
          </CardTitle>
          {resourceTypes.length > 0 && (
            <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2 max-w-[50%]">
              <div className="flex flex-wrap gap-1 justify-end">
                {resourceTypes.map((type, index) => (
                  <Badge key={`type-${index}`} variant="secondary" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <CardDescription className="text-sm text-gray-600 mt-1 leading-relaxed">
          {getResourceDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {resource.deadline && (
          <div className="flex items-center text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3 mr-1.5" />
            <span>Deadline: {formatDate(resource.deadline)}</span>
          </div>
        )}
        {resource.created_at && !resource.deadline && (
          <div className="flex items-center text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3 mr-1.5" />
            <span>Posted: {formatDate(resource.created_at)}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start"> 
        <Button variant="outline" size="sm" asChild className="w-full">
          <a href={getResourceLink()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
            Visit Resource
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        {resourceCategories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4 w-full">
            {resourceCategories.map((category, index) => (
              <Badge key={`cat-${index}`} variant="outline" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};
