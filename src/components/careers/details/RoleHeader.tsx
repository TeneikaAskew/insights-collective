
import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { DataCareerRole } from '@/data/dataCareerRoles';

interface RoleHeaderProps {
  role: DataCareerRole;
  onClose: () => void;
}

export const RoleHeader: React.FC<RoleHeaderProps> = ({ role, onClose }) => {
  const categories = role.category ? role.category.split(',').map(cat => cat.trim()) : [];
  
  return (
    <CardHeader className="relative pb-0">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {categories.map((category, index) => (
              <Badge key={index} className="border-transparent bg-accent text-accent-foreground hover:bg-accent">
                {category}
              </Badge>
            ))}
          </div>
          <CardTitle className="text-2xl font-display mb-1">{role.title}</CardTitle>
          <p className="ss-serif text-ss-peach-deep text-base">{role.shortDescription}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 rounded-full" aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
};
