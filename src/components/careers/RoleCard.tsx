
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DataCareerRole } from '@/data/dataCareerRoles';

interface RoleCardProps {
  role: DataCareerRole;
  isSelected: boolean;
  onClick: () => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, isSelected, onClick }) => {
  return (
    <Card 
      id={`role-${role.id}`}
      className={`hover:border-primary/50 transition-colors ${isSelected ? 'border-primary' : ''}`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-xl">{role.title}</CardTitle>
          <Badge variant="outline">{role.category}</Badge>
        </div>
        <CardDescription>{role.shortDescription}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="space-y-2">
          <div>
            <span className="font-medium">Key Tools:</span>{' '}
            <span className="text-muted-foreground">{role.tools.slice(0, 3).join(', ')}{role.tools.length > 3 ? '...' : ''}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onClick} 
          variant="ghost" 
          className="w-full flex items-center justify-center gap-1"
        >
          {isSelected ? (
            <>Close <ChevronUp className="h-4 w-4" /></>
          ) : (
            <>Explore Role <ChevronDown className="h-4 w-4" /></>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
