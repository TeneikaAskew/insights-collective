import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { CareerRoleDetails } from './CareerRoleDetails';

interface RoleCardProps {
  role: DataCareerRole;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  role
}) => {
  const [open, setOpen] = useState(false);
  
  // Format category text properly (handle acronyms like AI, UX)
  const formatCategoryLabel = (label: string): string => {
    // Check if the label is a known acronym that should be fully capitalized
    const knownAcronyms = ['ai', 'ui', 'ux', 'ml', 'ar', 'vr', 'qa', 'hr', 'pm', 'pr', 'seo', 'api'];
    
    if (label && knownAcronyms.includes(label.toLowerCase())) {
      return label.toUpperCase();
    }
    
    // Otherwise, return the label as is
    return label;
  };
  
  const categoryLabel = role.category.split(',')[0].trim();
  const formattedCategory = formatCategoryLabel(categoryLabel);
  
  return (
    <Card id={`role-${role.id}`} className="hover:border-primary/50 transition-colors h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-xl text-amber-500">{role.title}</CardTitle>
          <Badge variant="outline">{formattedCategory}</Badge>
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400">
              Explore Role <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-4xl w-[95vw]">
            <CareerRoleDetails role={role} onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
};
