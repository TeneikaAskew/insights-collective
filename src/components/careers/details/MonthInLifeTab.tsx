
import React from 'react';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataCareerRole } from '@/data/dataCareerRoles';

interface MonthInLifeTabProps {
  role: DataCareerRole;
}

export const MonthInLifeTab: React.FC<MonthInLifeTabProps> = ({ role }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">A Month in the Life</h3>
      </div>
      
      {role.monthInLife ? (
        <p className="text-muted-foreground">{role.monthInLife}</p>
      ) : (
        <p className="text-muted-foreground">No month-in-the-life information available for this role.</p>
      )}
      
      {role.projectTimeline && role.projectTimeline.length > 0 && (
        <div className="space-y-4 mt-6">
          <h4 className="font-medium">Sample Project Timeline</h4>
          <div className="space-y-4">
            {role.projectTimeline.map((phase, index) => (
              <Collapsible key={index}>
                <div className="flex items-center gap-2 rounded-md border p-3 cursor-pointer">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium">{phase.title}</h5>
                        <Badge variant="outline">{phase.duration}</Badge>
                      </div>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent className="pl-12 pr-4 pb-3">
                  <p className="text-muted-foreground">{phase.description}</p>
                  {phase.activities && phase.activities.length > 0 && (
                    <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                      {phase.activities.map((activity, idx) => (
                        <li key={idx}>{activity}</li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
