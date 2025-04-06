
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { CareerRoleDetails } from './CareerRoleDetails';

interface RoleCardProps {
  role: DataCareerRole;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role }) => {
  return (
    <Card 
      id={`role-${role.id}`}
      className="hover:border-primary/50 transition-colors h-full flex flex-col"
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-xl">{role.title}</CardTitle>
          <Badge variant="outline">{role.category}</Badge>
        </div>
        <CardDescription>{role.shortDescription}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm flex-grow">
        <div className="space-y-2">
          <div>
            <span className="font-medium">Key Tools:</span>{' '}
            <span className="text-muted-foreground">{role.tools.slice(0, 3).join(', ')}{role.tools.length > 3 ? '...' : ''}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-center gap-1"
            >
              Explore Role <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <CareerRoleDetails role={role} />
        </Dialog>
      </CardFooter>
    </Card>
  );
};
