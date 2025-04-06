
import React from 'react';
import { Clock } from 'lucide-react';
import { DataCareerRole } from '@/data/dataCareerRoles';

interface DayInLifeTabProps {
  role: DataCareerRole;
}

export const DayInLifeTab: React.FC<DayInLifeTabProps> = ({ role }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">A Day in the Life</h3>
      </div>
      <p className="text-muted-foreground mb-4">{role.dayInLife}</p>
      
      {role.schedule && (
        <div className="space-y-3 mt-6">
          <h4 className="font-medium">Typical Day Schedule</h4>
          {role.schedule.map((item, index) => (
            <div key={index} className="flex gap-3 border-l-2 border-primary/30 pl-4 py-1">
              <div className="font-medium w-24">{item.time}</div>
              <div className="flex-1">{item.activity}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
