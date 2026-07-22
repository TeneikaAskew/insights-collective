import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface CourseErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}

// Shared error block for the courses flow. Pages render this instead of
// silently substituting empty/default data when a fetch fails, so a broken
// backend is visibly distinct from a genuinely empty result.
const CourseErrorState = ({ title = 'Something went wrong', error, onRetry }: CourseErrorStateProps) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred while loading this content.';

  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default CourseErrorState;
