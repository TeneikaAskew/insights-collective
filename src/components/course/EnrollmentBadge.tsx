
import React from 'react';
import { Badge } from '@/components/ui/badge';

export interface EnrollmentBadgeProps {
  enrollmentStatus: string;
  courseId?: string;
}

const EnrollmentBadge: React.FC<EnrollmentBadgeProps> = ({ enrollmentStatus, courseId }) => {
  let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'outline';
  
  switch (enrollmentStatus.toLowerCase()) {
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
      {enrollmentStatus}
    </Badge>
  );
};

export default EnrollmentBadge;
