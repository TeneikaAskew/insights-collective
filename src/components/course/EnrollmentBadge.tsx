
import React from 'react';
import { Badge } from '@/components/ui/badge';

export interface EnrollmentBadgeProps {
  enrollmentStatus?: string;
  courseId?: string;
  status?: string; // Added to support both naming conventions
}

const EnrollmentBadge: React.FC<EnrollmentBadgeProps> = ({ enrollmentStatus, status, courseId }) => {
  // Use status prop if enrollmentStatus is not provided
  const displayStatus = enrollmentStatus || status || 'unknown';
  
  let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'outline';
  
  switch (displayStatus.toLowerCase()) {
    case 'open':
      variant = 'secondary';
      break;
    case 'in progress':
    case 'in-progress':
      variant = 'default';
      break;
    case 'closed':
      variant = 'destructive';
      break;
    default:
      variant = 'outline';
  }
  
  return (
    <Badge variant={variant} className="capitalize">
      {displayStatus}
    </Badge>
  );
};

export default EnrollmentBadge;
