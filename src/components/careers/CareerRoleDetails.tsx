
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataCareerRole } from '@/data/dataCareerRoles';

import { RoleHeader } from './details/RoleHeader';
import { OverviewTab } from './details/OverviewTab';
import { DayInLifeTab } from './details/DayInLifeTab';
import { MonthInLifeTab } from './details/MonthInLifeTab';
import { CareerPathTab } from './details/CareerPathTab';

interface CareerRoleDetailsProps {
  role: DataCareerRole;
  onClose: () => void;
}

export const CareerRoleDetails: React.FC<CareerRoleDetailsProps> = ({ role, onClose }) => {
  return (
    <Card className="ss-card animate-fade-in w-full max-h-[90vh] overflow-y-auto bg-card">
      <RoleHeader role={role} onClose={onClose} />

      <CardContent className="pt-4">
        <Tabs defaultValue="overview" className="space-y-4">
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
      </CardContent>
    </Card>
  );
};
