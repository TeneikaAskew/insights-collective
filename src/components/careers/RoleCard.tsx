import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { CareerRoleWage } from '@/hooks/useCareerRoleWages';
import WageBand from './WageBand';

interface RoleCardProps {
  role: DataCareerRole;
  /** BLS wage figures for this role, present once the wage query resolves. */
  wage?: CareerRoleWage;
  /**
   * Opens the detail dialog. The dialog lives on the page rather than in each
   * card, so the list view and the grid view share one instance instead of
   * mounting 33 of them.
   */
  onOpenRole: (roleId: string) => void;
}

// Acronyms that should stay fully capitalised in the category badge.
const ACRONYMS = ['ai', 'ui', 'ux', 'ml', 'ar', 'vr', 'qa', 'hr', 'pm', 'pr', 'seo', 'api'];

const formatCategoryLabel = (label: string): string =>
  ACRONYMS.includes(label.toLowerCase()) ? label.toUpperCase() : label;

export const RoleCard: React.FC<RoleCardProps> = ({ role, wage, onOpenRole }) => {
  const categoryLabel = formatCategoryLabel(role.category.split(',')[0].trim());

  return (
    <Card id={`role-${role.id}`} className="hover:border-primary/50 transition-colors h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-xl">{role.title}</CardTitle>
          <Badge variant="outline">{categoryLabel}</Badge>
        </div>
        <CardDescription>{role.shortDescription}</CardDescription>
      </CardHeader>

      <CardContent className="text-sm flex-grow">
        <div className="space-y-3">
          <div>
            <span className="font-medium">Key Tools:</span>{' '}
            <span className="text-muted-foreground">
              {role.tools.slice(0, 3).join(', ')}
              {role.tools.length > 3 ? '...' : ''}
            </span>
          </div>
          {wage && <WageBand wage={wage} className="pt-1" />}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full flex items-center justify-center gap-1"
          onClick={() => onOpenRole(role.id)}
        >
          Explore Role <ChevronRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};
