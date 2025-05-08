import { Card, CardContent, CardHeader, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink, Clock, BookOpen, MessageSquare } from 'lucide-react';
import { Resource, parseArrayField, normalizeString } from '@/hooks/useResources';
import { formatDistanceToNow } from 'date-fns';
interface ResourceCardProps {
  resource: Resource & {
    sourceType?: 'Tweet' | 'LinkedIn' | 'Standard'; // sourceType is optional as it's added post-fetch
  };
  isListView?: boolean; // Added to support list view
}
export const ResourceCard = ({
  resource,
  isListView = false
}: ResourceCardProps) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true
      });
    } catch (error) {
      return null;
    }
  };
  const getResourceCategories = (): string[] => {
    const categories = new Set<string>();
    if (resource.career_area) parseArrayField(resource.career_area).forEach(label => categories.add(formatCategoryLabel(normalizeString(label))));
    if (resource.predicted_career_labels) parseArrayField(resource.predicted_career_labels).forEach(label => categories.add(formatCategoryLabel(normalizeString(label))));
    if (resource.category && resource.category.toLowerCase() !== 'general') parseArrayField(resource.category).forEach(label => categories.add(formatCategoryLabel(normalizeString(label))));
    if (categories.size === 0 && resource.sourceType === 'Standard') categories.add('General');else if (categories.size === 0) categories.add('General'); // Fallback for non-Standard or if sourceType is undefined
    return Array.from(categories);
  };

  // Special formatting for acronyms and short labels (e.g., AI, UX, ML)
  const formatCategoryLabel = (label: string): string => {
    // Check if the label is a known acronym that should be fully capitalized
    const knownAcronyms = ['ai', 'ui', 'ux', 'ml', 'ar', 'vr', 'qa', 'hr', 'pm', 'pr', 'seo', 'api'];
    if (knownAcronyms.includes(label.toLowerCase())) {
      return label.toUpperCase();
    }

    // Otherwise, return the label as is (already normalized with first letter caps)
    return label;
  };
  const getResourceTypes = (): string[] => {
    const types = new Set<string>();
    if (resource.resource_type) parseArrayField(resource.resource_type).forEach(label => types.add(normalizeString(label)));
    if (resource.predicted_resource_labels) parseArrayField(resource.predicted_resource_labels).forEach(label => types.add(normalizeString(label)));
    if (types.size === 0 && resource.sourceType === 'Standard') types.add('Resource');else if (types.size === 0) types.add('Resource'); // Fallback
    return Array.from(types);
  };
  const getResourceLink = () => {
    if (!resource.resource_link && resource.source?.toLowerCase().includes('twitter') && resource.tweet_id) {
      return `https://x.com/teneikaask_you/status/${resource.tweet_id}`;
    }
    return resource.resource_link || '#';
  };
  const getButtonText = () => {
    if (resource.source?.toLowerCase().includes('twitter')) return 'View Tweet';
    if (resource.source?.toLowerCase().includes('linkedin')) return 'View LinkedIn Post';
    return 'View Resource';
  };
  const resourceCategories = getResourceCategories();
  const resourceTypes = getResourceTypes();
  const timeAgo = formatTimeAgo(resource.created_at);
  const getResourceDescription = () => {
    return resource.full_text || 'No description available.';
  };

  // Determine if this is a time-sensitive resource (has a deadline)
  const isTimeSensitive = !!resource.deadline;

  // Render list view
  if (isListView) {
    return <Card className="hover:shadow transition-shadow overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-2/3 p-4">
            <div className="flex flex-wrap gap-1 mb-2">
              {resourceCategories.map((category, index) => <Badge key={`cat-${index}`} variant="outline" className="text-xs">
                  {category}
                </Badge>)}
            </div>
            <CardDescription className="text-sm text-gray-600 leading-relaxed mb-2">
              {getResourceDescription()}
            </CardDescription>
            <div className="flex flex-wrap gap-1 mt-2">
              {resourceTypes.map((type, index) => <Badge key={`type-${index}`} variant="secondary" className="text-xs">
                  {type}
                </Badge>)}
            </div>
          </div>
          <div className="md:w-1/3 bg-gray-50 dark:bg-gray-800 p-4 flex flex-col justify-between">
            {isTimeSensitive ? <div className="flex items-center text-xs text-red-600 dark:text-red-400 font-medium">
                <Clock className="h-3 w-3 mr-1.5" />
                <span>Deadline: {formatDate(resource.deadline)}</span>
              </div> : timeAgo ? <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1.5" />
                <span>Posted: {timeAgo}</span>
              </div> : null}
            
            <Button variant="outline" size="sm" asChild className="mt-2">
              <a href={getResourceLink()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                {getButtonText()}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </Card>;
  }

  // Render grid view (default)
  return <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex flex-wrap gap-1 mb-2 w-full">
          {resourceCategories.map((category, index) => <Badge key={`cat-${index}`} variant="outline" className="text-xs">
              {category}
            </Badge>)}
        </div>
        
        <CardDescription className="text-sm text-gray-600 mt-1 leading-relaxed flex-grow">
          {getResourceDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0">
        {isTimeSensitive ? <div className="flex items-center text-xs text-red-600 dark:text-red-400 mb-2 font-medium">
            <Clock className="h-3 w-3 mr-1.5" />
            <span>Deadline: {formatDate(resource.deadline)}</span>
          </div> : timeAgo ? <div className="flex items-center text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3 mr-1.5" />
            <span>Posted: {timeAgo}</span>
          </div> : null}
        
        
      </CardContent>
      <CardFooter className="flex-col items-start pt-4 space-y-3">
        <Button variant="outline" size="sm" asChild className="w-full">
          <a href={getResourceLink()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
            {getButtonText()}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        
        {resourceTypes.length > 0 && <div className="flex flex-wrap gap-1 w-full justify-start mt-1">
            {resourceTypes.map((type, index) => <Badge key={`type-${index}`} variant="secondary" className="text-xs">
                {type}
              </Badge>)}
          </div>}
      </CardFooter>
    </Card>;
};