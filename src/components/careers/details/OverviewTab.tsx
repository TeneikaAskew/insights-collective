
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DataCareerRole } from '@/data/dataCareerRoles';

interface OverviewTabProps {
  role: DataCareerRole;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ role }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg mb-2">Role Description</h3>
        <p className="text-muted-foreground">{role.longDescription}</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-2">Key Responsibilities</h3>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {role.responsibilities.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-2">Who You Work With</h3>
            <div className="flex flex-wrap gap-2">
              {role.collaborators.map((collaborator, index) => (
                <Badge key={index} variant="secondary">{collaborator}</Badge>
              ))}
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-2">Tools & Skills</h3>
            <div className="flex flex-wrap gap-2">
              {role.tools.map((tool, index) => (
                <Badge key={index} variant="outline">{tool}</Badge>
              ))}
            </div>
          </div>
          
          {role.skills && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Key Skills</h3>
              <div className="flex flex-wrap gap-2">
                {role.skills.map((skill, index) => (
                  <Badge key={index} variant="outline" className="bg-primary/10">{skill}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
