
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

// Helper to normalize strings (lowercase, replace underscores with spaces, capitalize words)
const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^'|'$/g, ''); // Remove surrounding quotes if present
};

// Helper to parse string arrays that might be in JSON string format
const parseArrayField = (field: string | null | undefined): string[] => {
  if (!field) return [];
  
  // If it's already an array in string format like "['item1', 'item2']"
  if (field.startsWith('[') && field.endsWith(']')) {
    try {
      // Convert the string representation to actual array
      // Replace single quotes with double quotes for valid JSON
      const jsonStr = field.replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);
      
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && typeof item === 'string');
      }
    } catch (e) {
      // If parsing fails, split by comma as fallback
      return field
        .replace(/[\[\]']/g, '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }
  
  // If it's a simple string, just return it as a one-item array
  return field ? [field] : [];
};

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
    
    // Add career_area if present
    if (resource.career_area) {
      categories.add(resource.career_area);
    }
    
    // Add predicted_career_labels if present
    if (resource.predicted_career_labels) {
      const parsedLabels = parseArrayField(resource.predicted_career_labels);
      parsedLabels.forEach(label => categories.add(label));
    }
    
    // Include the original category field if present
    if (resource.category && resource.category !== 'General') {
      categories.add(resource.category);
    }
    
    // If we have no categories, add a default
    if (categories.size === 0) {
      categories.add('General');
    }
    
    return Array.from(categories);
  };

  // Parse and combine resource type fields
  const getResourceTypes = (): string[] => {
    const types = new Set<string>();
    
    // Add resource_type if present
    if (resource.resource_type) {
      types.add(resource.resource_type);
    }
    
    // Add predicted_resource_labels if present
    if (resource.predicted_resource_labels) {
      const parsedLabels = parseArrayField(resource.predicted_resource_labels);
      parsedLabels.forEach(label => types.add(label));
    }
    
    // If we have no types, add a default
    if (types.size === 0) {
      types.add('Resource');
    }
    
    return Array.from(types);
  };

  // Get the link, prioritizing different fields based on availability
  const getResourceLink = () => {
    return resource.resource_link || resource.tweet_url || resource.linkedin_url || '#';
  };

  // Get resource title or type information
  const getResourceTitle = () => {
    const types = getResourceTypes();
    if (types.length > 0) {
      return normalizeString(types[0]);
    }
    return 'Resource';
  };

  // Get resource description
  const getResourceDescription = () => {
    return resource.full_text || '';
  };

  // Get categories and types for display
  const categories = getResourceCategories();
  const resourceTypes = getResourceTypes();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-xl">{getResourceTitle()}</CardTitle>
            <div className="flex flex-wrap gap-1 justify-end">
              {categories.map((category, index) => (
                <Badge key={index} variant="outline" className="capitalize">
                  {normalizeString(category)}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {resourceTypes.length > 1 && resourceTypes.slice(1).map((type, index) => (
              <Badge key={index} variant="secondary" className="capitalize">
                {normalizeString(type)}
              </Badge>
            ))}
          </div>
          <CardDescription className="mt-2">{getResourceDescription()}</CardDescription>
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
