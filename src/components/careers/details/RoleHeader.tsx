
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
          <div className="flex items-center gap-2 mb-1">
            {categories.map((category, index) => (
              <Badge key={index} variant="outline">{category}</Badge>
            ))}
          </div>
          <CardTitle className="text-2xl font-bold mb-1">{role.title}</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
};
