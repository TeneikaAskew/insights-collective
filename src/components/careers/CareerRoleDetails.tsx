
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

interface CareerRoleDetailsProps {
  role: DataCareerRole;
  onClose: () => void;
  /** BLS figures for this role, rendered in the header. */
  wage?: CareerRoleWage;
}

export const CareerRoleDetails: React.FC<CareerRoleDetailsProps> = ({ role, onClose, wage }) => {
  return (
    <Card className="shadow-lg animate-fade-in border-t-4 border-t-primary w-full max-h-[90vh] overflow-y-auto">
      <RoleHeader role={role} onClose={onClose} wage={wage} />
      
      <CardContent className="pt-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="day-life">Day in the Life</TabsTrigger>
            <TabsTrigger value="month-life">Month in the Life</TabsTrigger>
            <TabsTrigger value="career-path">Career Path</TabsTrigger>
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
