
import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { CareerRoleWage } from '@/hooks/useCareerRoleWages';
import WageBand from '../WageBand';

interface RoleHeaderProps {
  role: DataCareerRole;
  onClose: () => void;
  /** Present once the wage query resolves; every role has one. */
  wage?: CareerRoleWage;
}

export const RoleHeader: React.FC<RoleHeaderProps> = ({ role, onClose, wage }) => {
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

      {/* The detail view previously showed no pay at all, which made it the one
          place a reader could not answer "what does this role earn?". */}
      {wage && <WageBand wage={wage} className="mt-4 max-w-md" />}
    </CardHeader>
  );
};
