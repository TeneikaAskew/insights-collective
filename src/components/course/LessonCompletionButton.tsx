import React, { useState } from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lessonCompletionService } from '@/services/lessonCompletionService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LessonCompletionButtonProps {
  lessonId: string;
  studentId: string;
  onCompletionChange?: (completed: boolean) => void;
  className?: string;
  showLabel?: boolean;
}

export const LessonCompletionButton: React.FC<LessonCompletionButtonProps> = ({
  lessonId,
  studentId,
  onCompletionChange,
  className,
  showLabel = true,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current completion status
  const { data: completion, isLoading } = useQuery({
    queryKey: ['lesson-completion', lessonId, studentId],
    queryFn: () => lessonCompletionService.getLessonCompletion(lessonId, studentId),
  });

  // Get completion requirements
  const { data: requirements } = useQuery({
    queryKey: ['lesson-requirements', lessonId],
    queryFn: () => lessonCompletionService.getLessonRequirements(lessonId),
  });

  // Check if requirements are met
  const { data: requirementsCheck } = useQuery({
    queryKey: ['lesson-requirements-check', lessonId, studentId],
    queryFn: () => lessonCompletionService.checkLessonRequirements(lessonId, studentId),
    enabled: !!requirements && requirements.length > 0,
  });

  const markCompleteMutation = useMutation({
    mutationFn: () => lessonCompletionService.markLessonComplete(lessonId, studentId),
    onSuccess: (result) => {
      if (result.alreadyCompleted) {
        toast({
          title: 'Already Completed',
          description: 'This lesson is already marked as complete.',
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['lesson-completion', lessonId] });
        queryClient.invalidateQueries({ queryKey: ['module-progress'] });
        queryClient.invalidateQueries({ queryKey: ['course-progress'] });
        onCompletionChange?.(true);
        toast({
          title: 'Success',
          description: 'Lesson marked as complete.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const markIncompleteMutation = useMutation({
    mutationFn: () => lessonCompletionService.markLessonIncomplete(lessonId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-completion', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['module-progress'] });
      queryClient.invalidateQueries({ queryKey: ['course-progress'] });
      onCompletionChange?.(false);
      toast({
        title: 'Success',
        description: 'Lesson marked as incomplete.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleToggle = async () => {
    setIsProcessing(true);
    
    try {
      if (completion) {
        await markIncompleteMutation.mutateAsync();
      } else {
        // Check if requirements are met
        if (requirementsCheck && !requirementsCheck.requirementsMet) {
          toast({
            title: 'Requirements Not Met',
            description: 'Please complete all requirements before marking this lesson as complete.',
            variant: 'destructive',
          });
          
          // Show which requirements are not met
          const unmetRequirements = requirementsCheck.requirements
            .filter(req => !req.met)
            .map(req => {
              switch (req.type) {
                case 'view':
                  return 'View the lesson content';
                case 'submit':
                  return 'Submit the assignment';
                case 'minimum_score':
                  return `Achieve minimum score of ${req.details?.minimum_score}%`;
                case 'participate':
                  return 'Participate in discussion';
                default:
                  return req.type;
              }
            });
          
          if (unmetRequirements.length > 0) {
            toast({
              title: 'Missing Requirements',
              description: (
                <ul className="list-disc pl-4 mt-2">
                  {unmetRequirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              ),
            });
          }
          
          setIsProcessing(false);
          return;
        }
        
        await markCompleteMutation.mutateAsync();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  const isCompleted = !!completion;
  const hasRequirements = requirements && requirements.length > 0;
  const requirementsMet = !hasRequirements || (requirementsCheck?.requirementsMet ?? false);

  const getTooltipContent = () => {
    if (isCompleted) {
      return `Completed on ${new Date(completion.completed_at).toLocaleDateString()}`;
    }
    
    if (hasRequirements && !requirementsMet) {
      return 'Complete all requirements to mark as done';
    }
    
    return 'Mark lesson as complete';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isCompleted ? "default" : "outline"}
            size="sm"
            onClick={handleToggle}
            disabled={isProcessing}
            className={cn(
              "transition-all",
              isCompleted && "bg-green-600 hover:bg-green-700",
              className
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCompleted ? (
              <Check className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            {showLabel && (
              <span className="ml-2">
                {isCompleted ? 'Completed' : 'Mark Complete'}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
          {hasRequirements && !isCompleted && (
            <div className="mt-2 text-xs">
              <p className="font-medium mb-1">Requirements:</p>
              {requirementsCheck?.requirements.map((req, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  {req.met ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Circle className="h-3 w-3 text-gray-400" />
                  )}
                  <span className={req.met ? 'text-green-500' : 'text-gray-400'}>
                    {req.type.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};