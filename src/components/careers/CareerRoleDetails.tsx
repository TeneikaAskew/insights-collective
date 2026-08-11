
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { CareerRoleWage } from '@/hooks/useCareerRoleWages';

import { RoleHeader } from './details/RoleHeader';
import { OverviewTab } from './details/OverviewTab';
import { DayInLifeTab } from './details/DayInLifeTab';
import { MonthInLifeTab } from './details/MonthInLifeTab';
import { CareerPathTab } from './details/CareerPathTab';
import { SimilarRolesSection } from './details/SimilarRolesSection';

interface CareerRoleDetailsProps {
  role: DataCareerRole;
  onClose: () => void;
  /** BLS row for this role; the header draws the full distribution from it. */
  wage?: CareerRoleWage;
  /**
   * Opens a different role in this same dialog, used by the Similar Roles
   * section. Optional: without it those entries render as plain cards.
   */
  onSelectRole?: (roleId: string) => void;
}

export const CareerRoleDetails: React.FC<CareerRoleDetailsProps> = ({ role, onClose, wage, onSelectRole }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Following a similar role swaps `role` underneath a card that is scrolled to
  // its own foot, which would drop the reader into the middle of the new role.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [role.id]);

  return (
    <Card ref={scrollRef} className="ss-card animate-fade-in w-full max-h-[90vh] overflow-y-auto bg-card">
      <RoleHeader role={role} onClose={onClose} wage={wage} />

      <CardContent className="pt-4">
        {/* Keyed so a swap resets to Overview rather than leaving the reader on
            the new role's Career Path tab. */}
        <Tabs key={role.id} defaultValue="overview" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">Overview</TabsTrigger>
            <TabsTrigger value="day-life" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">Day in the Life</TabsTrigger>
            <TabsTrigger value="month-life" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">Month in the Life</TabsTrigger>
            <TabsTrigger value="career-path" className="rounded-full px-4 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none">Career Path</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <OverviewTab role={role} />
          </TabsContent>
          
          <TabsContent value="day-life">
            <DayInLifeTab role={role} />
          </TabsContent>
          
          <TabsContent value="month-life">
            <MonthInLifeTab role={role} />
          </TabsContent>
          
          <TabsContent value="career-path">
            <CareerPathTab role={role} />
          </TabsContent>
        </Tabs>

        {/* Outside the Tabs so it sits at the foot of every tab, not just Overview. */}
        <SimilarRolesSection role={role} onSelectRole={onSelectRole} />
      </CardContent>
    </Card>
  );
};
