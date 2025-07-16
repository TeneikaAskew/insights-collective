import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getCategoryDisplayName } from '@/constants/courseCategories';

interface CourseCategoryBadgeProps {
  category: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

export function CourseCategoryBadge({ 
  category, 
  variant = 'secondary',
  className 
}: CourseCategoryBadgeProps) {
  const displayName = getCategoryDisplayName(category);
  
  return (
    <Badge variant={variant} className={className}>
      {displayName}
    </Badge>
  );
}

export default CourseCategoryBadge;